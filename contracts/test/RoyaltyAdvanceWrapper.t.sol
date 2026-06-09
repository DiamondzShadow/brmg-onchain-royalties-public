// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {RoyaltyAdvanceWrapper} from "../src/RoyaltyAdvanceWrapper.sol";

contract RoyaltyAdvanceWrapperTest is Test {
    RoyaltyAdvanceWrapper wrapper;

    address admin;
    address keeper;
    address artist;
    address stranger;

    bytes32 constant ESCROW_REF = keccak256("escrow-ref-1");
    uint256 constant VALUE = 50_000e6; // $50k trailing-12mo, 6-dec

    function setUp() public {
        admin = makeAddr("admin");
        keeper = makeAddr("keeper");
        artist = makeAddr("artist");
        stranger = makeAddr("stranger");

        wrapper = new RoyaltyAdvanceWrapper(admin);
        bytes32 role = wrapper.MESSENGER_ROLE();
        vm.prank(admin);
        wrapper.grantRole(role, keeper);
    }

    function _mint() internal returns (uint256 id) {
        vm.prank(keeper);
        id = wrapper.mintMirror(ESCROW_REF, artist, VALUE);
    }

    function test_MintMirrorDeterministicIdAndOwnership() public {
        uint256 id = _mint();
        assertEq(id, uint256(ESCROW_REF), "id == uint256(escrowRef)");
        assertEq(wrapper.ownerOf(id), artist, "artist owns mirror");

        (bytes32 ref, address a, uint256 val,,) = wrapper.info(id);
        assertEq(ref, ESCROW_REF);
        assertEq(a, artist);
        assertEq(val, VALUE);
    }

    function test_EstimatePositionValueReturnsScalar() public {
        uint256 id = _mint();
        (uint256 basket, uint256 yield, uint256 total) = wrapper.estimatePositionValue(id);
        assertEq(basket, 0);
        assertEq(yield, 0);
        assertEq(total, VALUE, "total carries conservative value");
    }

    function test_OnlyKeeperCanMint() public {
        vm.prank(stranger);
        vm.expectRevert();
        wrapper.mintMirror(ESCROW_REF, artist, VALUE);
    }

    function test_CannotMintTwice() public {
        _mint();
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(RoyaltyAdvanceWrapper.AlreadyMinted.selector, uint256(ESCROW_REF)));
        wrapper.mintMirror(ESCROW_REF, artist, VALUE);
    }

    function test_PushValueUpdatesScalar() public {
        uint256 id = _mint();
        uint256 newVal = 62_500e6;
        vm.prank(keeper);
        wrapper.pushValue(id, newVal);
        (,, uint256 total) = wrapper.estimatePositionValue(id);
        assertEq(total, newVal, "value refreshed");
    }

    function test_OnlyKeeperCanPushValue() public {
        uint256 id = _mint();
        vm.prank(artist);
        vm.expectRevert();
        wrapper.pushValue(id, 1);
    }

    function test_PushValueRevertsIfNotMinted() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(RoyaltyAdvanceWrapper.NotMinted.selector, uint256(ESCROW_REF)));
        wrapper.pushValue(uint256(ESCROW_REF), 1);
    }

    function test_OwnerBurnAndRedeemEmitsEscrowRef() public {
        uint256 id = _mint();
        vm.expectEmit(true, true, true, true);
        emit RoyaltyAdvanceWrapper.BurnRequested(id, ESCROW_REF, artist);
        vm.prank(artist);
        wrapper.burnAndRedeem(id);

        // burned: ownerOf reverts, info cleared
        vm.expectRevert();
        wrapper.ownerOf(id);
        (bytes32 ref,,,,) = wrapper.info(id);
        assertEq(ref, bytes32(0), "info cleared");
    }

    function test_StrangerCannotBurn() public {
        uint256 id = _mint();
        vm.prank(stranger);
        vm.expectRevert(RoyaltyAdvanceWrapper.NotOwner.selector);
        wrapper.burnAndRedeem(id);
    }

    function test_ApprovedCanBurn() public {
        uint256 id = _mint();
        vm.prank(artist);
        wrapper.approve(stranger, id);
        vm.prank(stranger);
        wrapper.burnAndRedeem(id); // no revert
        vm.expectRevert();
        wrapper.ownerOf(id);
    }

    function test_SupportsInterfaces() public view {
        assertTrue(wrapper.supportsInterface(0x80ac58cd), "ERC721");
        assertTrue(wrapper.supportsInterface(0x7965db0b), "AccessControl");
    }
}
