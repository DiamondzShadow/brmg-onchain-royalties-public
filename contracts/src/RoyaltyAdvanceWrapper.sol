// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title RoyaltyAdvanceWrapper (Polygon chain 137)
/// @notice Polygon-side mirror of a Royalty-Token position escrowed on Story.
///         Minted by a keeper (`MESSENGER_ROLE`) after it observes a
///         `RoyaltyEscrow.Locked` on Story; the artist borrows USDC against
///         this NFT through the live Polygon lending stack, then burns it to
///         signal redemption.
///
///         Models `ShadowVaultV15/contracts/ccip/ArbPositionWrapper` but with
///         the CCIP `ccipReceive` path replaced by keeper calls, since Story
///         has no CCIP lane (see RoyaltyEscrow). Like that blueprint it is its
///         OWN valuer: `estimatePositionValue(id) -> (0, 0, lastValueUSDC)`,
///         so it drops straight into `NFTValuer` mirror mode with the wrapper
///         address as both collection and valuer — no separate valuer contract.
///
///         Conservative valuation policy (trailing-12mo claimed revenue x 1.0,
///         ~15% LTV at registration) lives in the keeper that pushes value;
///         this contract just stores the latest scalar.
///
///         tokenId is deterministic: `uint256(escrowRef)`, where escrowRef is
///         the Story escrow's position ref. One escrow ⇒ one mirror.
contract RoyaltyAdvanceWrapper is ERC721, AccessControl, ReentrancyGuard {
    using Strings for uint256;

    /// @dev Keeper that mirrors Story custody and refreshes value.
    bytes32 public constant MESSENGER_ROLE = keccak256("MESSENGER_ROLE");

    struct MirrorInfo {
        bytes32 escrowRef; // Story RoyaltyEscrow position ref
        address artist; // original recipient / Story redeem-to
        uint256 lastValueUSDC; // 6-dec conservative value, keeper-pushed
        uint64 lastValueAt; // last value-update ts (for keeper freshness)
        uint64 lockedAt; // mint ts
    }

    mapping(uint256 => MirrorInfo) public info;

    event Minted(uint256 indexed id, address indexed artist, bytes32 escrowRef, uint256 valueUSDC);
    event ValueUpdated(uint256 indexed id, uint256 newValueUSDC);
    event BurnRequested(uint256 indexed id, bytes32 indexed escrowRef, address indexed artist);

    error ZeroAddress();
    error AlreadyMinted(uint256 id);
    error NotMinted(uint256 id);
    error NotOwner();

    constructor(address admin) ERC721("BRMG Royalty Advance", "brmgRA") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ════════════════════════════════════════════════════════════
    //  Keeper: mint + value-update
    // ════════════════════════════════════════════════════════════

    /// @notice Mint the Polygon mirror for a Story escrow. Called by the keeper
    ///         after observing `RoyaltyEscrow.Locked`.
    /// @param escrowRef  Story escrow position ref (also becomes the tokenId).
    /// @param artist     mirror recipient (== Story redeem-to).
    /// @param valueUSDC  initial conservative value (6-dec).
    function mintMirror(bytes32 escrowRef, address artist, uint256 valueUSDC)
        external
        onlyRole(MESSENGER_ROLE)
        nonReentrant
        returns (uint256 id)
    {
        if (artist == address(0)) revert ZeroAddress();
        id = uint256(escrowRef);
        if (_ownerOf(id) != address(0)) revert AlreadyMinted(id);

        info[id] = MirrorInfo({
            escrowRef: escrowRef,
            artist: artist,
            lastValueUSDC: valueUSDC,
            lastValueAt: uint64(block.timestamp),
            lockedAt: uint64(block.timestamp)
        });
        _safeMint(artist, id);
        emit Minted(id, artist, escrowRef, valueUSDC);
    }

    /// @notice Refresh the stored conservative value. Keeper-callable; keeps the
    ///         lending pool's health check current as claimed revenue evolves.
    function pushValue(uint256 id, uint256 valueUSDC) external onlyRole(MESSENGER_ROLE) {
        if (_ownerOf(id) == address(0)) revert NotMinted(id);
        info[id].lastValueUSDC = valueUSDC;
        info[id].lastValueAt = uint64(block.timestamp);
        emit ValueUpdated(id, valueUSDC);
    }

    // ════════════════════════════════════════════════════════════
    //  Valuer compat — NFTValuer mirror mode reads this
    // ════════════════════════════════════════════════════════════

    /// @notice Single-scalar value getter. basketVal/yieldVal are 0; `total`
    ///         carries the conservative USDC value (6-dec).
    function estimatePositionValue(uint256 id)
        external
        view
        returns (uint256 basketVal, uint256 yieldVal, uint256 total)
    {
        total = info[id].lastValueUSDC;
    }

    // ════════════════════════════════════════════════════════════
    //  Owner: burn → redeem
    // ════════════════════════════════════════════════════════════

    /// @notice Burn the mirror to signal redemption of the Story escrow. The
    ///         keeper observes `BurnRequested` and calls
    ///         `RoyaltyEscrow.releaseEscrow(escrowRef)` to return the RT.
    ///
    ///         Caller must OWN the mirror (or be approved). While the mirror is
    ///         deposited in the lending pool as collateral the pool owns it, so
    ///         this implicitly requires the loan to have been repaid and the
    ///         mirror withdrawn first — no separate loan check needed.
    function burnAndRedeem(uint256 id) external nonReentrant {
        address owner = _ownerOf(id);
        if (owner == address(0)) revert NotMinted(id);
        if (msg.sender != owner && !isApprovedForAll(owner, msg.sender) && getApproved(id) != msg.sender) {
            revert NotOwner();
        }

        MirrorInfo memory m = info[id];
        _burn(id);
        delete info[id];
        emit BurnRequested(id, m.escrowRef, m.artist);
    }

    // ════════════════════════════════════════════════════════════
    //  ERC-165 + tokenURI
    // ════════════════════════════════════════════════════════════

    function tokenURI(uint256 id) public view override returns (string memory) {
        MirrorInfo memory m = info[id];
        return string(
            abi.encodePacked(
                "data:application/json;utf8,",
                '{"name":"BRMG Royalty Advance #',
                id.toString(),
                '","description":"Polygon mirror of Royalty Tokens escrowed on Story. Collateral value pushed by the BRMG keeper.",',
                '"attributes":[',
                '{"trait_type":"Escrow Ref","value":"',
                Strings.toHexString(uint256(m.escrowRef), 32),
                '"},',
                '{"trait_type":"Artist","value":"',
                Strings.toHexString(uint160(m.artist), 20),
                '"},',
                '{"trait_type":"Value USDC","value":"',
                m.lastValueUSDC.toString(),
                '"},',
                '{"trait_type":"Last Update","value":"',
                uint256(m.lastValueAt).toString(),
                '"}',
                "]}"
            )
        );
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
