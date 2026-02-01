import api from "./api";

export type AgentPairingResponse = {
  code: string;
  expiresAt: string;
};

export const agentService = {
  async createPairing(schoolId: string, ttlMinutes?: number) {
    const response = await api.post<AgentPairingResponse>(
      `/schools/${schoolId}/agent-pairing`,
      {
        ttlMinutes,
      },
    );
    return response.data;
  },
};
