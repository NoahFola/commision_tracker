/**
 * Shape returned by GET /api/auth/me.
 * Discriminated on subjectType so consumers narrow cleanly.
 */
export type AuthMeAdmin = {
  subjectType: 'ADMIN';
  subjectId: string;
  email: string;
  name: string;
  profilePictureUrl: string | null;
  roles: ['ADMIN'];
};

export type AuthMeAgent = {
  subjectType: 'AGENT';
  subjectId: string;
  email: string;
  name: string;
  profilePictureUrl: string | null;
  roles: ['AGENT'] | ['AMBASSADOR'];
  agentId: string;
  agentType: 'AGENT' | 'AMBASSADOR';
  referralCode: string;
};

export type AuthMe = AuthMeAdmin | AuthMeAgent;
