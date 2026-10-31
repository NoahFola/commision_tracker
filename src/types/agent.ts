import type { AgentType, AgentStatus, OnboardingStage, PayoutMethod } from '@/models/agent.model';

/**
 * Summary of an Agent for list views. Deliberately excludes
 * `payoutPreference` — account numbers are not needed in a list, and
 * minimal disclosure is the rule.
 */
export type AgentListItem = {
  id: string;
  fullName: string;
  type: AgentType;
  email: string;
  phone: string;
  status: AgentStatus;
  onboardingStage: OnboardingStage;
  referralCode: string;
  commissionRate: number; // basis points (500 = 5.00%)
  dateJoined: string; // ISO
  region: { id: string; name: string };
};

/**
 * Full Agent detail. Returned by GET /api/agents/[id] and by the create
 * endpoint. Includes `payoutPreference` — this is the only read endpoint
 * (besides create) that returns it. Never includes passwordHash; that
 * lives on AgentUser, not Agent, and is never returned.
 */
export type AgentDetail = {
  id: string;
  fullName: string;
  type: AgentType;
  email: string;
  phone: string;
  status: AgentStatus;
  onboardingStage: OnboardingStage;
  referralCode: string;
  dateJoined: string; // ISO
  profilePictureUrl: string | null;
  payoutPreference: {
    method: PayoutMethod;
    provider?: string;
    accountNumber?: string;
    accountName?: string;
    isDefault: boolean;
  };
  region: { id: string; name: string };
};
