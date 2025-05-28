#[test_only]
module did_registry::did_registry_tests;

use did_registry::did_registry::{
    Self,
    DIDRegistry,
    ENotAuthorized,
    EDIDAlreadyExists,
    EDIDNotFound,
    EDIDRevoked,
    EIndexOutOfBounds // Added new error code
};
use std::string;
use sui::test_scenario as ts;
use sui::test_utils;

const ADMIN: address = @0xA11CE;
const USER1: address = @0xB0B;

#[test]
fun test_did_lifecycle() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Register a DID
    let did_id = string::utf8(b"did:sui:123");
    let document = b"{\"id\":\"did:sui:123\"}";
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id, document, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Resolve DID and verify contents
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        let resolved_doc = did_registry::resolve_did(&registry, did_id);
        assert!(resolved_doc == document, 1000);
        ts::return_shared(registry);
    };

    // Update DID document
    let new_doc = b"{\"id\":\"did:sui:123\",\"updated\":true}";
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::update_did(&mut registry, did_id, new_doc, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Verify update was successful
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        let resolved_doc = did_registry::resolve_did(&registry, did_id);
        assert!(resolved_doc == new_doc, 1001);
        ts::return_shared(registry);
    };

    // Revoke DID
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::revoke_did(&mut registry, did_id, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Verify revocation
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        let is_revoked = did_registry::is_revoked(&registry, did_id);
        assert!(is_revoked, 1002);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

/// Test that resolving a revoked DID fails with EDIDRevoked
#[test]
#[expected_failure(abort_code = EDIDRevoked)]
fun test_resolve_revoked_did() {
    let mut scenario = ts::begin(ADMIN);

    // Setup: Initialize registry and register a DID
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(
            &mut registry,
            string::utf8(b"did:sui:revoked"),
            b"{}",
            ts::ctx(&mut scenario),
        );
        ts::return_shared(registry);
    };

    // Revoke the DID
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::revoke_did(
            &mut registry,
            string::utf8(b"did:sui:revoked"),
            ts::ctx(&mut scenario),
        );
        ts::return_shared(registry);
    };

    // Try to resolve the revoked DID - this should abort
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::resolve_did(&registry, string::utf8(b"did:sui:revoked"));

        // Since we expect an abort above, this code is unreachable but satisfies compiler
        test_utils::destroy(registry);
    };

    ts::end(scenario);
}

/// Test that registering a duplicate DID fails with EDIDAlreadyExists
#[test]
#[expected_failure(abort_code = EDIDAlreadyExists)]
fun test_duplicate_did_registration() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Register a DID
    let did_id = string::utf8(b"did:sui:dup");
    let document = b"{\"id\":\"did:sui:dup\"}";
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id, document, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Try to register the same DID again - this should abort
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id, document, ts::ctx(&mut scenario));

        // Since we expect an abort above, this code is unreachable but satisfies compiler
        test_utils::destroy(registry);
    };

    ts::end(scenario);
}

/// Test that updating a DID by non-controller fails with ENotAuthorized
#[test]
#[expected_failure(abort_code = ENotAuthorized)]
fun test_unauthorized_update() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Register a DID as ADMIN
    let did_id = string::utf8(b"did:sui:auth");
    let document = b"{\"id\":\"did:sui:auth\"}";
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id, document, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Try to update as USER1 (not controller) - this should abort
    let new_doc = b"{\"id\":\"did:sui:auth\",\"hacked\":true}";
    ts::next_tx(&mut scenario, USER1);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::update_did(&mut registry, did_id, new_doc, ts::ctx(&mut scenario));

        // Since we expect an abort above, this code is unreachable but satisfies compiler
        test_utils::destroy(registry);
    };

    ts::end(scenario);
}

/// Test that revoking a DID by non-controller fails with ENotAuthorized
#[test]
#[expected_failure(abort_code = ENotAuthorized)]
fun test_unauthorized_revocation() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Register a DID as ADMIN
    let did_id = string::utf8(b"did:sui:auth");
    let document = b"{\"id\":\"did:sui:auth\"}";
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id, document, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Try to revoke as USER1 (not controller) - this should abort
    ts::next_tx(&mut scenario, USER1);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::revoke_did(&mut registry, did_id, ts::ctx(&mut scenario));

        // Since we expect an abort above, this code is unreachable but satisfies compiler
        test_utils::destroy(registry);
    };

    ts::end(scenario);
}

/// Test that resolving a non-existent DID fails with EDIDNotFound
#[test]
#[expected_failure(abort_code = EDIDNotFound)]
fun test_resolve_nonexistent_did() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Try to resolve a non-existent DID - this should abort
    let nonexistent_did = string::utf8(b"did:sui:nonexistent");
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::resolve_did(&registry, nonexistent_did);

        // Since we expect an abort above, this code is unreachable but satisfies compiler
        test_utils::destroy(registry);
    };

    ts::end(scenario);
}

/// Test that updating a non-existent DID fails with EDIDNotFound
#[test]
#[expected_failure(abort_code = EDIDNotFound)]
fun test_update_nonexistent_did() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Try to update a non-existent DID - this should abort
    let nonexistent_did = string::utf8(b"did:sui:nonexistent");
    ts::next_tx(&mut scenario, USER1);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::update_did(
            &mut registry,
            nonexistent_did,
            b"{\"id\":\"did:sui:nonexistent\"}",
            ts::ctx(&mut scenario),
        );

        // Since we expect an abort above, this code is unreachable but satisfies compiler
        test_utils::destroy(registry);
    };

    ts::end(scenario);
}

/// Test that revoking a non-existent DID fails with EDIDNotFound
#[test]
#[expected_failure(abort_code = EDIDNotFound)]
fun test_revoke_nonexistent_did() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Try to revoke a non-existent DID - this should abort
    let nonexistent_did = string::utf8(b"did:sui:nonexistent");
    ts::next_tx(&mut scenario, USER1);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::revoke_did(&mut registry, nonexistent_did, ts::ctx(&mut scenario));

        // Since we expect an abort above, this code is unreachable but satisfies compiler
        test_utils::destroy(registry);
    };

    ts::end(scenario);
}

/// Test helper functions (did_exists, get_controller, is_revoked)
#[test]
fun test_helper_functions() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Register a DID
    let did_id = string::utf8(b"did:sui:helper");
    let document = b"{\"id\":\"did:sui:helper\"}";
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id, document, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Test did_exists
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        assert!(did_registry::did_exists(&registry, did_id), 2000);
        assert!(
            !did_registry::did_exists(&registry, string::utf8(b"did:sui:nonexistent_helper")),
            2001,
        );
        ts::return_shared(registry);
    };

    // Test get_controller
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        let controller = did_registry::get_controller(&registry, did_id);
        assert!(controller == ADMIN, 2002);
        ts::return_shared(registry);
    };

    // Test is_revoked (before revocation)
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        assert!(!did_registry::is_revoked(&registry, did_id), 2003);
        ts::return_shared(registry);
    };

    // Revoke the DID
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::revoke_did(&mut registry, did_id, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Test is_revoked (after revocation)
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        assert!(did_registry::is_revoked(&registry, did_id), 2004);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

// NEW TEST: Test DID listing functionality
#[test]
fun test_did_listing_functions() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Register multiple DIDs
    let did_id1 = string::utf8(b"did:sui:123");
    let did_id2 = string::utf8(b"did:sui:456");
    let did_id3 = string::utf8(b"did:sui:789");
    
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id1, b"{\"id\":\"did:sui:123\"}", ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };
    
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id2, b"{\"id\":\"did:sui:456\"}", ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };
    
    ts::next_tx(&mut scenario, USER1);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id3, b"{\"id\":\"did:sui:789\"}", ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Test get_did_count
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        let count = did_registry::get_did_count(&registry);
        assert!(count == 3, 3000);
        ts::return_shared(registry);
    };

    // Test get_did_at_index
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        let first_did = did_registry::get_did_at_index(&registry, 0);
        let second_did = did_registry::get_did_at_index(&registry, 1);
        let third_did = did_registry::get_did_at_index(&registry, 2);
        
        assert!(first_did == did_id1, 3001);
        assert!(second_did == did_id2, 3002);
        assert!(third_did == did_id3, 3003);
        
        ts::return_shared(registry);
    };

    // Test get_did_info_at_index
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        
        let (controller1, revoked1) = did_registry::get_did_info_at_index(&registry, 0);
        let (controller2, revoked2) = did_registry::get_did_info_at_index(&registry, 1);
        let (controller3, revoked3) = did_registry::get_did_info_at_index(&registry, 2);
        
        assert!(controller1 == ADMIN, 3004);
        assert!(controller2 == ADMIN, 3005);
        assert!(controller3 == USER1, 3006);
        
        assert!(!revoked1, 3007);
        assert!(!revoked2, 3008);
        assert!(!revoked3, 3009);
        
        ts::return_shared(registry);
    };

    // Test list_all_dids
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        let count = did_registry::list_all_dids(&registry);
        assert!(count == 3, 3010);
        ts::return_shared(registry);
    };

    // Revoke a DID and check that info is updated
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::revoke_did(&mut registry, did_id1, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        let (_, revoked) = did_registry::get_did_info_at_index(&registry, 0);
        assert!(revoked, 3011);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

// NEW TEST: Test index out of bounds error
#[test]
#[expected_failure(abort_code = EIndexOutOfBounds)]
fun test_did_index_out_of_bounds() {
    let mut scenario = ts::begin(ADMIN);

    // Initialize registry
    ts::next_tx(&mut scenario, ADMIN);
    did_registry::init_for_testing(ts::ctx(&mut scenario));

    // Register a single DID
    let did_id = string::utf8(b"did:sui:123");
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::register_did(&mut registry, did_id, b"{\"id\":\"did:sui:123\"}", ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Try to access an out-of-bounds index
    ts::next_tx(&mut scenario, USER1);
    {
        let registry = ts::take_shared<DIDRegistry>(&scenario);
        did_registry::get_did_at_index(&registry, 1); // Index 1 does not exist

        // Since we expect an abort above, this code is unreachable but satisfies compiler
        test_utils::destroy(registry);
    };

    ts::end(scenario);
}
