// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RoyaltyEscrow} from "../src/RoyaltyEscrow.sol";

/// @notice Deploy RoyaltyEscrow on Story (1514) and grant the keeper
///         MESSENGER_ROLE. Dry-run by default; add --broadcast to send.
///
///   forge script script/DeployEscrowStory.s.sol \
///     --rpc-url $STORY_RPC --slow [--broadcast]
///
/// env: DEPLOYER_PK, ESCROW_ADMIN (Safe/EOA), ESCROW_KEEPER (keeper EOA)
contract DeployEscrowStory is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address admin = vm.envAddress("ESCROW_ADMIN");
        address keeper = vm.envAddress("ESCROW_KEEPER");

        vm.startBroadcast(pk);

        RoyaltyEscrow escrow = new RoyaltyEscrow(admin);
        escrow.grantRole(escrow.MESSENGER_ROLE(), keeper);

        vm.stopBroadcast();

        console2.log("RoyaltyEscrow:", address(escrow));
        console2.log("admin:", admin);
        console2.log("keeper (MESSENGER_ROLE):", keeper);
    }
}
