export class HandProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandProtocolError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class HandNotFoundError extends HandProtocolError {
  constructor(key: string) {
    super(`HAND account not found for ${key}`);
    this.name = "HandNotFoundError";
  }
}

export class DelegationNotFoundError extends HandProtocolError {
  constructor(hand: string, agent: string) {
    super(`Delegation not found for hand=${hand}, agent=${agent}`);
    this.name = "DelegationNotFoundError";
  }
}

export class ReputationNotFoundError extends HandProtocolError {
  constructor(hand: string) {
    super(`Reputation account not found for hand=${hand}`);
    this.name = "ReputationNotFoundError";
  }
}

export class InvalidProofError extends HandProtocolError {
  constructor() {
    super("Invalid zero-knowledge proof");
    this.name = "InvalidProofError";
  }
}

export class AgentNotVerifiedError extends HandProtocolError {
  constructor(agent: string) {
    super(`Agent ${agent} has no valid delegation from any HAND`);
    this.name = "AgentNotVerifiedError";
  }
}

export class DelegationExpiredError extends HandProtocolError {
  constructor(agent: string, expiresAt: number) {
    super(`Delegation for agent ${agent} expired at ${new Date(expiresAt * 1000).toISOString()}`);
    this.name = "DelegationExpiredError";
  }
}

export class InsufficientReputationError extends HandProtocolError {
  constructor(current: number, required: number) {
    super(`Reputation score ${current} is below required ${required}`);
    this.name = "InsufficientReputationError";
  }
}
