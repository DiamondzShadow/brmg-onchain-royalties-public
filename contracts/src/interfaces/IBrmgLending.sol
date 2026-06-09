// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal interfaces for the LIVE Polygon (137) lending stack the
///         RoyaltyAdvanceWrapper registers into. Addresses (verified 2026-04-20,
///         re-verify before broadcasting):
///           DiggerRegistry 0x151c4752A875dc5CE40A466bc85F85Ece6756e86
///           NFTValuer      0xD6F819B0Ea9091988D38D937fC6745E142990Ba8
///           LendingPool    0x2e5b111447a93ca2b900e9da96822344d6Be49eC
///           USDC (native)  0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
///
///         ⚠️ These signatures are reconstructed from session memory. CONFIRM
///         against the on-chain ABI (Blockscout `get_contract_abi`) before
///         using them in a broadcast tx — the wiring step is intentionally
///         kept out of the deploy script for this reason.
interface IDiggerRegistry {
    /// @notice Register an in-house collection; maxLtvBps>0 ⇒ isCollateral.
    function registerInHouseCollection(address collection, address valuer, uint256 maxLtvBps) external;
    function isListable(address collection) external view returns (bool);
    function isCollateral(address collection) external view returns (bool);
}

interface INFTValuer {
    /// @notice Point `collection` at `valuer` in mirror mode (clamp=0). For the
    ///         RoyaltyAdvanceWrapper, collection == valuer == the wrapper itself.
    function setMirrorMode(address collection, address valuer, uint256 clamp) external;
    function estimatePositionValue(address collection, uint256 tokenId)
        external
        view
        returns (uint256, uint256, uint256);
}
