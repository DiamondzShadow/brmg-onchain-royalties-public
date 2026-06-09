// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {RoyaltyEscrow} from "../src/RoyaltyEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract RoyaltyEscrowTest is Test {
    RoyaltyEscrow escrow;
    MockERC20 rt;

    address admin;
    address keeper;
    address artist;
    address ipAsset;

    uint256 constant AMOUNT = 100_000_000e18; // 100M RT

    function setUp() public {
        admin = makeAddr("admin");
        keeper = makeAddr("keeper");
        artist = makeAddr("artist");
        ipAsset = makeAddr("ipAsset");

        escrow = new RoyaltyEscrow(admin);
        bytes32 role = escrow.MESSENGER_ROLE();
        vm.prank(admin);
        escrow.grantRole(role, keeper);

        rt = new MockERC20("Royalty Token", "RT");
        rt.mint(artist, AMOUNT);
    }

    function _lock() internal returns (bytes32 ref) {
        vm.startPrank(artist);
        rt.approve(address(escrow), AMOUNT);
        ref = escrow.lockForAdvance(address(rt), AMOUNT, ipAsset);
        vm.stopPrank();
    }

    function test_LockEscrowsTokensAndRecordsPosition() public {
        bytes32 ref = _lock();

        assertEq(rt.balanceOf(address(escrow)), AMOUNT, "escrow holds RT");
        assertEq(rt.balanceOf(artist), 0, "artist drained");

        (address a, address t, uint256 amt, address ip,, RoyaltyEscrow.Status status) = escrow.positions(ref);
        assertEq(a, artist);
        assertEq(t, address(rt));
        assertEq(amt, AMOUNT);
        assertEq(ip, ipAsset);
        assertEq(uint8(status), uint8(RoyaltyEscrow.Status.Locked));
    }

    function test_RefIsDeterministicAndNonceBumps() public {
        bytes32 expected0 = keccak256(abi.encode(artist, address(rt), ipAsset, uint256(0)));
        bytes32 ref0 = _lock();
        assertEq(ref0, expected0, "ref matches off-chain derivation");
        assertEq(escrow.nonce(), 1, "nonce bumped");
    }

    function test_KeeperReleasesToArtist() public {
        bytes32 ref = _lock();

        vm.prank(keeper);
        escrow.releaseEscrow(ref);

        assertEq(rt.balanceOf(artist), AMOUNT, "RT returned");
        assertEq(rt.balanceOf(address(escrow)), 0, "escrow emptied");
        (,,,,, RoyaltyEscrow.Status status) = escrow.positions(ref);
        assertEq(uint8(status), uint8(RoyaltyEscrow.Status.Released));
    }

    function test_NonKeeperCannotRelease() public {
        bytes32 ref = _lock();
        vm.prank(artist);
        vm.expectRevert();
        escrow.releaseEscrow(ref);
    }

    function test_CannotReleaseTwice() public {
        bytes32 ref = _lock();
        vm.startPrank(keeper);
        escrow.releaseEscrow(ref);
        vm.expectRevert(RoyaltyEscrow.NotLocked.selector);
        escrow.releaseEscrow(ref);
        vm.stopPrank();
    }

    function test_LockRevertsOnZeroAmount() public {
        vm.prank(artist);
        vm.expectRevert(RoyaltyEscrow.ZeroAmount.selector);
        escrow.lockForAdvance(address(rt), 0, ipAsset);
    }

    function test_LockRevertsOnZeroToken() public {
        vm.prank(artist);
        vm.expectRevert(RoyaltyEscrow.ZeroAddress.selector);
        escrow.lockForAdvance(address(0), AMOUNT, ipAsset);
    }
}
