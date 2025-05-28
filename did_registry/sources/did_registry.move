module did_registry::did_registry;

use std::string::{String};
use sui::event;
use sui::table::{Self, Table};


// Error codes
const ENotAuthorized: u64 = 0;
const EDIDAlreadyExists: u64 = 1;
const EDIDNotFound: u64 = 2;
const EDIDRevoked: u64 = 3;
const EIndexOutOfBounds: u64 = 4;  // New error code for index out of bounds

/// DIDRecord stores one DID Document and its metadata
public struct DIDRecord has key, store {
    id: UID,
    did_id: String,
    controller: address,
    document: vector<u8>, // serialized JSON
    revoked: bool,
}

/// Main registry object, holds the Table of DIDs
public struct DIDRegistry has key {
    id: UID,
    dids: Table<String, DIDRecord>,
    all_dids: vector<String>, 
}

/// Events - need copy + drop for event emission
public struct DIDRegistered has copy, drop {
    did_id: String,
    controller: address,
}

public struct DIDUpdated has copy, drop {
    did_id: String,
    controller: address,
}

public struct DIDRevoked has copy, drop {
    did_id: String,
    controller: address,
}

/// Module initializer: called once at publish time
fun init(ctx: &mut TxContext) {
    let registry = DIDRegistry {
        id: object::new(ctx),
        dids: table::new(ctx),
        all_dids: vector::empty<String>(),
    };
    transfer::share_object(registry);
}

/// Register a new DID
public entry fun register_did(
    registry: &mut DIDRegistry,
    did_id: String,
    document: vector<u8>,
    ctx: &mut TxContext,
) {
    // Ensure uniqueness
    let exists = table::contains(&registry.dids, did_id);
    assert!(!exists, EDIDAlreadyExists);

    let controller = tx_context::sender(ctx);

    // Create a copy of the DID for tracking
    // Correctly copy the string by making new string from bytes
    let did_copy = did_id;
    
    // Add to tracking vector
    vector::push_back(&mut registry.all_dids, did_copy);
    
    // Create the record
    let record = DIDRecord {
        id: object::new(ctx),
        did_id,
        controller,
        document,
        revoked: false,
    };

    // Add DID to the table
    table::add(&mut registry.dids, did_id, record);
    
    event::emit(DIDRegistered { did_id, controller });
}

/// Resolve a DID (returns the document if not revoked)
public fun resolve_did(registry: &DIDRegistry, did_id: String): vector<u8> {
    assert!(table::contains(&registry.dids, did_id), EDIDNotFound);

    let record = table::borrow(&registry.dids, did_id);
    assert!(!record.revoked, EDIDRevoked);

    record.document
}

/// Update a DID document (only controller)
public entry fun update_did(
    registry: &mut DIDRegistry,
    did_id: String,
    new_document: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(table::contains(&registry.dids, did_id), EDIDNotFound);

    let record = table::borrow_mut(&mut registry.dids, did_id);
    let sender = tx_context::sender(ctx);

    assert!(sender == record.controller, ENotAuthorized);
    assert!(!record.revoked, EDIDRevoked); // Prevent updating revoked DIDs

    record.document = new_document;

    event::emit(DIDUpdated { did_id, controller: sender });
}

/// Revoke a DID (only controller)
public entry fun revoke_did(
    registry: &mut DIDRegistry,
    did_id: String,
    ctx: &mut TxContext,
) {
    assert!(table::contains(&registry.dids, did_id), EDIDNotFound);

    let record = table::borrow_mut(&mut registry.dids, did_id);
    let sender = tx_context::sender(ctx);

    assert!(sender == record.controller, ENotAuthorized);
    assert!(!record.revoked, EDIDRevoked); // Prevent revoking already revoked DIDs

    record.revoked = true;

    event::emit(DIDRevoked { did_id, controller: sender });
}

// Helper: check if a DID exists
public fun did_exists(registry: &DIDRegistry, did_id: String): bool {
    table::contains(&registry.dids, did_id)
}

// Helper: get controller address
public fun get_controller(registry: &DIDRegistry, did_id: String): address {
    assert!(table::contains(&registry.dids, did_id), EDIDNotFound);
    let record = table::borrow(&registry.dids, did_id);
    record.controller
}

// Helper: check revocation status
public fun is_revoked(registry: &DIDRegistry, did_id: String): bool {
    assert!(table::contains(&registry.dids, did_id), EDIDNotFound);
    let record = table::borrow(&registry.dids, did_id);
    record.revoked
}

// NEW FUNCTION: Get total count of registered DIDs
public fun get_did_count(registry: &DIDRegistry): u64 {
    vector::length(&registry.all_dids)
}

// NEW FUNCTION: Get a DID by index
public fun get_did_at_index(registry: &DIDRegistry, index: u64): String {
    assert!(index < vector::length(&registry.all_dids), EIndexOutOfBounds);
    *vector::borrow(&registry.all_dids, index)
}

// NEW FUNCTION: Get DID metadata (controller and revocation status) by index
public fun get_did_info_at_index(registry: &DIDRegistry, index: u64): (address, bool) {
    assert!(index < vector::length(&registry.all_dids), EIndexOutOfBounds);
    
    let did_id = vector::borrow(&registry.all_dids, index);
    let record = table::borrow(&registry.dids, *did_id);
    
    (record.controller, record.revoked)
}

// NEW FUNCTION: List all DIDs - returns count for client-side iteration
public fun list_all_dids(registry: &DIDRegistry): u64 {
    get_did_count(registry)
}



#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    let registry = DIDRegistry {
        id: object::new(ctx),
        dids: table::new(ctx),
        all_dids: vector::empty<String>()  // Initialize this for testing too
    };
    transfer::share_object(registry);
}
