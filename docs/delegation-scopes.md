# Delegation Scopes

Scoped delegation is the core mechanism that differentiates HAND from simple agent registries. Instead of binary trust (agent is registered / not registered), HAND encodes what an agent is allowed to do directly on-chain.

## Scope Fields

### allowed_programs: Vec\<Pubkey\>

Whitelist of program IDs the agent can interact with through this delegation.

- Empty list: no restriction, agent can interact with any program
- Non-empty: agent actions are limited to these specific programs

Example: restrict a trading bot to Jupiter and Raydium only.

```typescript
scope.allowedPrograms = [JUPITER_PROGRAM_ID, RAYDIUM_PROGRAM_ID];
```

Maximum 10 programs per delegation to prevent account size bloat.

### max_lamports_per_tx: u64

Maximum lamports the agent can spend in a single transaction.

- 0: no per-transaction limit
- Non-zero: each `consume()` call checks this limit

Example: cap at 2 SOL per transaction.

```typescript
scope.maxLamportsPerTx = 2_000_000_000; // 2 SOL in lamports
```

### max_lamports_total: u64

Lifetime spending cap across all transactions under this delegation.

- 0: no lifetime limit
- Non-zero: `spent_lamports` is tracked and checked against this cap

When `spent_lamports >= max_lamports_total`, the delegation is effectively exhausted.

### spent_lamports: u64

Running counter updated by `consume()`. Tracks cumulative spending.

Reset only by creating a new delegation (revoking and re-delegating).

### expires_at: i64

Unix timestamp after which the delegation is invalid.

- 0: no expiration
- Non-zero: `consume()` checks `Clock::get()?.unix_timestamp < expires_at`

### allowed_actions: u16

Bitflag field controlling which action types the agent can perform.

| Flag | Value | Action |
|---|---|---|
| ACTION_SWAP | 0x0001 | Token swaps on DEXes |
| ACTION_STAKE | 0x0002 | Staking / unstaking |
| ACTION_TRANSFER | 0x0004 | Token transfers |
| ACTION_VOTE | 0x0008 | Governance voting |
| ACTION_MINT | 0x0010 | Minting (NFTs, tokens) |
| ACTION_ALL | 0xFFFF | All actions permitted |

Combine flags with bitwise OR:

```typescript
// Allow swap and stake only
const actions = ACTION_SWAP | ACTION_STAKE; // 0x0003
```

## Consume Flow

When a partner protocol gates an action behind HAND, the flow is:

```
1. Agent submits transaction to partner protocol
2. Partner protocol calls delegation::consume() via CPI
3. consume() checks:
   a. Delegation is active
   b. Not expired (expires_at == 0 || now < expires_at)
   c. Action type is in allowed_actions (action & allowed_actions != 0)
   d. Program ID is in allowed_programs (or list is empty)
   e. Lamports within per-tx limit
   f. Cumulative lamports within total limit
4. If all pass: updates spent_lamports, returns success
5. If any fail: returns error, partner protocol rejects the action
```

## Delegation Lifecycle

```
Create           Update           Consume           Revoke
  │                │                 │                 │
  ▼                ▼                 ▼                 ▼
┌──────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Init │────►│ Active   │────►│ Active   │────►│ Inactive │
│      │     │ (scope A)│     │ (scope B)│     │          │
└──────┘     └──────────┘     └──────────┘     └──────────┘
                                    │
                                    ▼ (budget exhausted or expired)
                              ┌──────────┐
                              │ Depleted │
                              └──────────┘
```

## Multi-Agent Patterns

A single Hand can delegate to up to 5 agents simultaneously, each with different scopes:

```
Hand (verified human)
  ├── Agent A: Trading bot
  │   └── Scope: Jupiter only, 2 SOL/tx, 50 SOL total, 72h, SWAP
  ├── Agent B: Governance bot
  │   └── Scope: Realms only, no lamport limit, no expiry, VOTE
  └── Agent C: DCA bot
      └── Scope: Jupiter + Orca, 0.5 SOL/tx, 100 SOL total, 30d, SWAP
```

## Integration Example

Partner program Cargo.toml:

```toml
[dependencies]
delegation = { git = "https://github.com/WritNetwork/writ-v1", features = ["cpi"] }
```

Partner instruction:

```rust
use delegation::cpi::accounts::ConsumeDelegation;
use delegation::cpi::consume;

pub fn guarded_swap(ctx: Context<GuardedSwap>, amount: u64) -> Result<()> {
    let cpi_ctx = CpiContext::new(
        ctx.accounts.delegation_program.to_account_info(),
        ConsumeDelegation {
            delegation: ctx.accounts.delegation.to_account_info(),
            hand: ctx.accounts.hand.to_account_info(),
            agent: ctx.accounts.agent.to_account_info(),
            clock: ctx.accounts.clock.to_account_info(),
        },
    );

    consume(cpi_ctx, amount, ACTION_SWAP, ctx.program_id.key())?;

    // Proceed with the actual swap logic
    // ...

    Ok(())
}
```
