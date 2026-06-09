// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title RoyaltyEscrow (Story chain 1514)
/// @notice Story-side leg of the BRMG royalty-advance bridge. An artist locks
///         their share of an IP Asset's Royalty Tokens (the ERC-20 minted by
///         Story's `RoyaltyTokenDistributionWorkflows` 100M split) here as the
///         "real" collateral backing a USDC advance taken on Polygon.
///
///         Story mainnet (1514) is NOT on Chainlink CCIP (only `story-testnet`
///         1513 exists in the chain-selectors registry, and the CCIP directory
///         has no Story mainnet page). So instead of `ccipReceive`, custody is
///         coordinated by a trusted off-chain keeper holding `MESSENGER_ROLE`:
///
///           1. Artist calls `lockForAdvance(rtToken, amount, ipAsset)` here —
///              RT transfers in, a deterministic `escrowRef` is emitted.
///           2. Keeper observes `Locked`, computes a conservative valuation
///              (trailing-12mo claimed revenue x 1.0) and mints a mirror NFT on
///              Polygon (`RoyaltyAdvanceWrapper.mintMirror(escrowRef, ...)`).
///           3. Artist borrows USDC against the mirror on Polygon, later repays,
///              withdraws the mirror, and burns it (`burnAndRedeem`).
///           4. Keeper observes the Polygon `BurnRequested` and calls
///              `releaseEscrow(escrowRef)` here, returning the RT to the artist.
///
///         The trust model is intra-protocol: BRMG owns both this escrow and the
///         Polygon lending venue, so the keeper is only trusted not to release
///         before the Polygon loan is settled. CCIP-style action codes are kept
///         in the keeper so this can be swapped to a real lane if Story adds one.
contract RoyaltyEscrow is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Keeper that mirrors custody to Polygon and releases on repayment.
    bytes32 public constant MESSENGER_ROLE = keccak256("MESSENGER_ROLE");

    enum Status {
        None,
        Locked,
        Released
    }

    struct Position {
        address artist; // who locked; RT is returned here on release
        address rtToken; // Royalty Token (ERC-20) being escrowed
        uint256 amount; // RT amount held
        address ipAsset; // Story IP Asset this RT belongs to (informational)
        uint64 lockedAt; // unix ts
        Status status;
    }

    /// @notice escrowRef => position. escrowRef == the Polygon mirror tokenId.
    mapping(bytes32 => Position) public positions;

    /// @notice monotonic counter mixed into escrowRef so one artist can open
    ///         multiple advances against the same (rtToken, ipAsset) pair.
    uint256 public nonce;

    event Locked(
        bytes32 indexed escrowRef,
        address indexed artist,
        address indexed rtToken,
        uint256 amount,
        address ipAsset
    );
    event Released(bytes32 indexed escrowRef, address indexed artist, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error NotLocked();

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ════════════════════════════════════════════════════════════
    //  Artist: lock
    // ════════════════════════════════════════════════════════════

    /// @notice Lock `amount` of `rtToken` as backing for a Polygon advance.
    ///         Caller must have approved this contract for `amount` first.
    /// @return escrowRef deterministic id (== Polygon mirror tokenId).
    function lockForAdvance(address rtToken, uint256 amount, address ipAsset)
        external
        nonReentrant
        returns (bytes32 escrowRef)
    {
        if (rtToken == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        escrowRef = keccak256(abi.encode(msg.sender, rtToken, ipAsset, nonce++));
        positions[escrowRef] = Position({
            artist: msg.sender,
            rtToken: rtToken,
            amount: amount,
            ipAsset: ipAsset,
            lockedAt: uint64(block.timestamp),
            status: Status.Locked
        });

        IERC20(rtToken).safeTransferFrom(msg.sender, address(this), amount);
        emit Locked(escrowRef, msg.sender, rtToken, amount, ipAsset);
    }

    // ════════════════════════════════════════════════════════════
    //  Keeper: release
    // ════════════════════════════════════════════════════════════

    /// @notice Return the escrowed RT to the artist. Called by the keeper only
    ///         after it has confirmed the Polygon mirror was burned (which
    ///         itself requires the Polygon loan to have been repaid and the
    ///         mirror withdrawn from the lending pool).
    function releaseEscrow(bytes32 escrowRef) external onlyRole(MESSENGER_ROLE) nonReentrant {
        Position storage p = positions[escrowRef];
        if (p.status != Status.Locked) revert NotLocked();
        p.status = Status.Released;
        IERC20(p.rtToken).safeTransfer(p.artist, p.amount);
        emit Released(escrowRef, p.artist, p.amount);
    }
}
