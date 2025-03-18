import credits.aleo;
import pondo_protocol.aleo;
import token_registry.aleo;

// Yokin Pool - A no-loss lottery protocol on Aleo
// Users deposit Aleo credits, receive Paleo tokens, and enter the pool
// One winner is randomly selected to win all the yield generated from deposits
// All participants can withdraw their original deposits after the pool ends
program yokin_pool_7_test.aleo {
    // Field ID for the Paleo token in the token registry
    const PALEO_TOKEN_ID: field = 1751493913335802797273486270793650302076377624243810059080883537084141842600field;

    // Main data structure to track the state of a single pool
    struct Pool {
        pool_id: u64,                       // Unique identifier for the pool
        total_deposit: u64,                 // Total credits deposited by all users
        total_paleo: u64,                   // Total Paleo tokens minted
        total_players: u64,                 // Total number of player entries/slots
        reward: u64,                        // Yield generated during the pool duration
        deposit_deadline_timestamp: u32,    // Unix timestamp when deposits close
        withdrawal_start_timestamp: u32,    // Unix timestamp when withdrawals open
        deposit_deadline_block: u32,        // Block height when deposits close
        withdrawal_start_block: u32,        // Block height when withdrawals open
        winner: address,                    // Address of the randomly selected winner
    }

    // Associates a player with a specific pool for tracking deposits
    struct PlayerPool {
        player: address,
        pool_id: u64,
    }

    // Represents a single lottery entry (slot) for a player in a pool
    // More slots = higher chance of winning
    struct PlayerSlot {
        pool_id: u64,
        player_id: u64,                     // Sequential ID for the player's slot
    }

    // Tracks withdrawal state in Pondo protocol
    struct withdrawal_state {
        microcredits: u64,
        claim_block: u32
    }

    // Constant for default keys in mappings
    const DEFAULT_KEY: u8 = 0u8;
    
    // Tracks if the contract has been initialized
    mapping initialized: u8 => bool;
    // Tracks the admin address
    mapping admin: u8 => address;
    
    // Stores all pool data by pool ID
    mapping pools: u64 => Pool;
    // Tracks the total number of pools created
    mapping pool_count: u8 => u64;

    // Tracks player deposits in each pool
    mapping balances: field => u64;
    // Maps lottery slots to player addresses
    mapping player_slots: field => address;
    // Tracks the winner for each pool
    mapping pool_winner: u64 => address;

    // Initializes the contract with an admin address
    // Can only be called once
    async transition initialize(public init_admin: address) -> Future {
        return finalize_initialize(init_admin);
    }

    async function finalize_initialize(public init_admin: address) {
        let is_initialized: bool = initialized.get_or_use(DEFAULT_KEY, false);
        assert(!is_initialized);

        admin.set(DEFAULT_KEY, init_admin);
        initialized.set(DEFAULT_KEY, true);
    }

    // Creates a new lottery pool with specified timelines
    // Only the admin can create pools
    async transition create_pool_public(current_timestamp: u32, deposit_deadline_timestamp: u32, est_withdrawal_start_timestamp: u32) -> Future {
        return finalize_create_pool_public(self.caller, current_timestamp, deposit_deadline_timestamp, est_withdrawal_start_timestamp);
    }

    async function finalize_create_pool_public(
        public caller: address,
        current_timestamp: u32,
        deposit_deadline_timestamp: u32,
        est_withdrawal_start_timestamp: u32
    ) {
        assert(caller == admin.get(DEFAULT_KEY));

        // Get current count (or 0 if not set)
        let count: u64 = pool_count.get_or_use(0u8, 0u64);
        let new_id: u64 = count + 1u64;

        // Convert timestamp to estimated block height
        let deposit_deadline_block: u32 = block.height + ((deposit_deadline_timestamp - current_timestamp)/3u32);

        // Create new pool with initial values
        let new_pool: Pool = Pool {
            pool_id: new_id,
            total_deposit: 0u64,
            total_paleo: 0u64,
            total_players: 0u64,
            reward: 0u64,
            deposit_deadline_timestamp: deposit_deadline_timestamp,
            withdrawal_start_timestamp: est_withdrawal_start_timestamp,
            deposit_deadline_block: deposit_deadline_block, 
            withdrawal_start_block: 0u32,
            winner: aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc, // Default empty address
        };

        pools.set(new_id, new_pool);
        pool_count.set(0u8, new_id);
    }

    // Allows a user to join a pool by depositing credits
    // 1. Deposits credits into Pondo protocol
    // 2. Receives Paleo tokens
    // 3. Allocates lottery slots based on deposit amount
    async transition join_pool_public(
        public pool_id: u64,
        public credits_deposit: u64,
        public expected_paleo_mint: u64
    ) -> Future {
        // Deposit credits to Pondo and receive Paleo tokens
        let f0: Future = pondo_protocol.aleo/deposit_public_as_signer(credits_deposit, expected_paleo_mint, self.address);
        let f1: Future = token_registry.aleo/transfer_public_as_signer(PALEO_TOKEN_ID, self.address, expected_paleo_mint as u128);

        return finalize_join_pool_public(f0, f1, pool_id, self.signer, credits_deposit, expected_paleo_mint);
    }

    async function finalize_join_pool_public(
        public f0: Future,
        public f1: Future,
        public pool_id: u64,
        public player: address,
        public credits_deposit: u64,
        public expected_paleo_mint: u64
    ) {
        f0.await();
        f1.await();

        let current_pool: Pool = pools.get(pool_id);

        // Ensure pool is still accepting deposits
        assert(block.height < current_pool.deposit_deadline_block);

        // Track the player's deposit in this pool
        let player_pool: PlayerPool = PlayerPool {
            player: player,
            pool_id: pool_id
        };
        let player_pool_hash: field = BHP256::hash_to_field(player_pool);
        let player_balance: u64 = balances.get_or_use(player_pool_hash, 0u64);
        let new_player_balance: u64 = player_balance + credits_deposit;
        balances.set(player_pool_hash, new_player_balance);

        // Slot allocation system:
        // 1. Each player gets 1 base slot for any deposit
        // 2. Additional slots are allocated for every 77 Aleo (77,000,000 credits)
        // 3. Maximum 14 slots total (required for exactly 1,000 Aleo)
        // 1 Aleo = 1,000,000 credits and equals ~$0.28
        let num_of_slots: u64 = (credits_deposit / 77_000_000u64) + 1u64;
        let start_player_id: u64 = current_pool.total_players;
        
        // Cap at 14 slots maximum (14 slots + 1 balance update + 1 pool update = 16 operations)
        // This is due to Aleo's limit of 16 mapping operations per function
        let max_slots: u64 = 14u64;
        let slots_to_create: u64 = num_of_slots > max_slots ? max_slots : num_of_slots;
        
        // Allocate first slot (always at least 1)
        {
            let player_slot: PlayerSlot = PlayerSlot {
                pool_id: pool_id,
                player_id: start_player_id
            };
            let player_slot_hash: field = BHP256::hash_to_field(player_slot);
            player_slots.set(player_slot_hash, player);
        }
        
        // Allocate remaining slots (up to 13 more)
        if slots_to_create > 1u64 {
            for i: u64 in 1u64..14u64 {
                if i < slots_to_create {
                    let player_slot: PlayerSlot = PlayerSlot {
                        pool_id: pool_id,
                        player_id: start_player_id + i
                    };
                    let player_slot_hash: field = BHP256::hash_to_field(player_slot);
                    player_slots.set(player_slot_hash, player);
                }
            }
        }

        // Update pool with new totals
        let new_pool: Pool = Pool {
            pool_id: pool_id,
            total_deposit: current_pool.total_deposit + credits_deposit,
            total_paleo: current_pool.total_paleo + expected_paleo_mint,
            total_players: current_pool.total_players + slots_to_create, // Use actual slots created
            reward: 0u64,
            deposit_deadline_timestamp: current_pool.deposit_deadline_timestamp,
            withdrawal_start_timestamp: current_pool.withdrawal_start_timestamp,
            deposit_deadline_block: current_pool.deposit_deadline_block,
            withdrawal_start_block: current_pool.withdrawal_start_block,
            winner: current_pool.winner,
        };
        pools.set(pool_id, new_pool);
    }

    // Initiates the withdrawal of Paleo tokens to get back credits + yield
    // Only callable by admin after deposit period ends
    async transition slow_withdraw_public (
        public pool_id: u64,
        public paleo_burn_amount: u64,
        public current_timestamp: u32
    ) -> Future {
        // Burn Paleo tokens to withdraw credits + yield
        let f0: Future = pondo_protocol.aleo/withdraw_public(paleo_burn_amount);
        return finalize_slow_withdraw_public(f0, pool_id, self.caller, paleo_burn_amount, current_timestamp);
    }

    async function finalize_slow_withdraw_public(
        public f0: Future,
        public pool_id: u64,
        public caller: address,
        public paleo_burn_amount: u64,
        public current_timestamp: u32
    ) {
        f0.await();

        assert(caller == admin.get(DEFAULT_KEY));

        let current_pool: Pool = pools.get(pool_id);

        // Ensure deposit period is over and the pool hasn't been finalized
        assert(block.height > current_pool.deposit_deadline_block && current_pool.withdrawal_start_block == 0u32);
        assert(current_pool.total_paleo == paleo_burn_amount);

        // Get withdrawal information from Pondo
        let withdrawal: withdrawal_state = pondo_protocol.aleo/withdrawals.get(self.address);

        // Calculate estimated withdrawal time
        let estimated_withdrawal_timestamp: u32 = current_timestamp + ((withdrawal.claim_block - block.height) * 3u32);

        // Update pool with withdrawal information
        let new_pool: Pool = Pool {
            pool_id: current_pool.pool_id,
            total_deposit: current_pool.total_deposit,
            total_paleo: current_pool.total_paleo,
            total_players: current_pool.total_players,
            reward: current_pool.reward,
            deposit_deadline_timestamp: current_pool.deposit_deadline_timestamp,
            withdrawal_start_timestamp: estimated_withdrawal_timestamp,
            deposit_deadline_block: current_pool.deposit_deadline_block,
            withdrawal_start_block: withdrawal.claim_block,
            winner: current_pool.winner,
        };
        pools.set(current_pool.pool_id, new_pool);
    }

    // Claims the withdrawn credits + yield from Pondo
    // Called after slow_withdraw_public when withdrawal is ready
    // 1. Go to https://aleoscan.io/program?id=pondo_protocol.aleo 
    // 2. Call withdrawals (address -> withdrawal_state) with admin address
    // 3. Copy the values for microcredits and claim_block (e.g. {microcredits: 999501u64, claim_block: 5584153u32})
    // 4. Call claim_withdraw_public with the microcredits as `withdraw_aleo_amount`
    async transition claim_withdraw_public (public pool_id: u64, public withdraw_aleo_amount: u64) -> Future {
        let f0: Future = pondo_protocol.aleo/claim_withdrawal_public(self.address, withdraw_aleo_amount);
        return finalize_claim_withdraw_public(f0, pool_id, withdraw_aleo_amount);
    }

    async function finalize_claim_withdraw_public(
        public f0: Future,
        public pool_id: u64,
        public withdraw_aleo_amount: u64,
    ) {
        f0.await();
        let current_pool: Pool = pools.get(pool_id);
        assert(current_pool.total_paleo > 0u64);
        
        // Calculate the reward (yield) as the difference between withdrawn amount and total deposit
        let reward: u64 = withdraw_aleo_amount > current_pool.total_deposit ? withdraw_aleo_amount - current_pool.total_deposit : 0u64;
        
        // Update pool with the calculated reward
        let new_pool: Pool = Pool {
            pool_id: current_pool.pool_id,
            total_deposit: current_pool.total_deposit,
            total_paleo: current_pool.total_paleo,
            total_players: current_pool.total_players,
            reward: reward,
            deposit_deadline_timestamp: current_pool.deposit_deadline_timestamp,
            withdrawal_start_timestamp: current_pool.withdrawal_start_timestamp,
            deposit_deadline_block: current_pool.deposit_deadline_block,
            withdrawal_start_block: current_pool.withdrawal_start_block,
            winner: current_pool.winner,
        };
        pools.set(current_pool.pool_id, new_pool);
    }
    
    // Selects a random winner for the pool
    // Uses ChaCha random number generator to pick a slot
    // Only callable by admin
    async transition random_winner_public(
        public pool_id: u64,
    ) -> Future {
        return finalize_random_winner_public(pool_id, self.caller);
    }

    async function finalize_random_winner_public(
        public pool_id: u64,
        public caller: address,
    ) {
        assert(caller == admin.get(DEFAULT_KEY));

        let random_number: u64 = ChaCha::rand_u64();
        let current_pool: Pool = pools.get(pool_id);

        // Ensure winner hasn't been selected yet
        assert(current_pool.winner == aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc); 

        // Select a random slot and get the owner as winner
        let winner_slot: PlayerSlot = PlayerSlot {
            pool_id: pool_id,
            player_id: random_number % current_pool.total_players
        };
        let winner_slot_hash: field = BHP256::hash_to_field(winner_slot);
        let winner: address = player_slots.get(winner_slot_hash);
        pool_winner.set(pool_id, winner);

        // Update pool with winner information
        let new_pool: Pool = Pool {
            pool_id: current_pool.pool_id,
            total_deposit: current_pool.total_deposit,
            total_paleo: current_pool.total_paleo,
            total_players: current_pool.total_players,
            reward: current_pool.reward,
            deposit_deadline_timestamp: current_pool.deposit_deadline_timestamp,
            withdrawal_start_timestamp: current_pool.withdrawal_start_timestamp,
            deposit_deadline_block: current_pool.deposit_deadline_block,
            withdrawal_start_block: current_pool.withdrawal_start_block,
            winner: winner,
        };
        pools.set(current_pool.pool_id, new_pool);
    }

    // Allows players to redeem their deposits
    // Winner gets deposit + reward, others get only their deposit back
    async transition redeem_public(
        public pool_id: u64,
        public player: address,
        public credits_redeem: u64,
    ) -> Future {
        // Transfer credits back to the player
        let f0: Future = credits.aleo/transfer_public(player, credits_redeem);
        return finalize_redeem_public(f0, pool_id, player, credits_redeem);
    }

    async function finalize_redeem_public(
        public f0: Future, 
        public pool_id: u64,
        public player: address,
        public credits_redeem: u64,
    ) {
        f0.await();

        let current_pool: Pool = pools.get(pool_id);
        // Ensure redemption period has started
        assert(current_pool.withdrawal_start_block != 0u32 && block.height > current_pool.withdrawal_start_block);
        
        // Get player's deposit amount
        let player_pool: PlayerPool = PlayerPool {
            player: player,
            pool_id: pool_id
        };
        let player_pool_hash: field = BHP256::hash_to_field(player_pool);
        let deposit_amount: u64 = balances.get(player_pool_hash);

        // Check if player is the winner to determine redeem amount
        let winner: address = pool_winner.get(pool_id);
        if player == winner {
            let reward: u64 = current_pool.reward;
            assert(credits_redeem == deposit_amount + reward);
        } else {
            assert(credits_redeem == deposit_amount);
        }

        // Reset player's balance after redemption
        balances.set(player_pool_hash, 0u64);
    }

    // Updates the admin address
    // Only callable by the current admin
    async transition update_admin_public(public new_admin: address) -> Future {
        return finalize_update_admin_public(self.caller, new_admin);
    }

    async function finalize_update_admin_public(
        public caller: address, 
        public new_admin: address
    ) {
        assert(caller == admin.get(DEFAULT_KEY));
        admin.set(DEFAULT_KEY, new_admin);
    }
}