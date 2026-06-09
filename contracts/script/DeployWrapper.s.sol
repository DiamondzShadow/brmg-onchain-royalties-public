// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RoyaltyAdvanceWrapper} from "../src/RoyaltyAdvanceWrapper.sol";

/// @notice Deploy RoyaltyAdvanceWrapper on a destination chain and grant the
///         keeper MESSENGER_ROLE. The wrapper is chain-agnostic — deploy the
///         SAME contract on every advance venue (Polygon 137 and/or Arbitrum
///         42161); only the RPC and the post-deploy wiring addresses differ.
///         Dry-run by default; add --broadcast to send.
///
///   # Polygon
///   forge script script/DeployWrapper.s.sol \
///     --rpc-url https://polygon-bor-rpc.publicnode.com --slow [--broadcast]
///   # Arbitrum
///   forge script script/DeployWrapper.s.sol --rpc-url $ARB_RPC --slow [--broadcast]
///
/// env: DEPLOYER_PK, WRAPPER_ADMIN (per-chain Safe/EOA), WRAPPER_KEEPER (keeper EOA)
///
/// AFTER deploy, wire into that chain's lending stack (verify ABIs first — see
/// contracts/README.md "Wiring"; wrapper is its own valuer ⇒ collection==valuer):
///   DiggerRegistry.registerInHouseCollection(wrapper, wrapper, 1500)  // 15% LTV
///   NFTValuer.setMirrorMode(wrapper, wrapper, 0)
contract DeployWrapper is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address admin = vm.envAddress("WRAPPER_ADMIN");
        address keeper = vm.envAddress("WRAPPER_KEEPER");

        vm.startBroadcast(pk);

        RoyaltyAdvanceWrapper wrapper = new RoyaltyAdvanceWrapper(admin);
        wrapper.grantRole(wrapper.MESSENGER_ROLE(), keeper);

        vm.stopBroadcast();

        console2.log("RoyaltyAdvanceWrapper:", address(wrapper));
        console2.log("chainid:", block.chainid);
        console2.log("admin:", admin);
        console2.log("keeper (MESSENGER_ROLE):", keeper);
    }
}
