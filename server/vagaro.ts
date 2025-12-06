interface VagaroTokenResponse {
  status: number;
  responseCode: number;
  message: string;
  data?: {
    access_token: string;
    expires_in: number;
  };
}

interface VagaroEmployee {
  employeeId: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  email?: string;
}

interface VagaroEmployeesResponse {
  status: number;
  responseCode: number;
  message: string;
  data?: {
    employees: VagaroEmployee[];
  };
}

export class VagaroClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;

  constructor(settings: {
    vagaroClientId: string | null;
    vagaroClientSecret: string | null;
    vagaroRegion: string | null;
  }) {
    if (!settings.vagaroClientId || !settings.vagaroClientSecret) {
      throw new Error("Vagaro credentials not configured");
    }
    
    const region = settings.vagaroRegion || "us";
    this.baseUrl = `https://api.vagaro.com/${region}/api/v2`;
    this.clientId = settings.vagaroClientId;
    this.clientSecret = settings.vagaroClientSecret;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/merchants/generate-access-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecretKey: this.clientSecret,
        scope: "employees:read",
      }),
    });

    const data = await response.json() as VagaroTokenResponse;
    
    if (data.status !== 200 || !data.data?.access_token) {
      throw new Error(data.message || "Failed to get Vagaro access token");
    }

    this.accessToken = data.data.access_token;
    return this.accessToken;
  }

  async getEmployees(): Promise<VagaroEmployee[]> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/merchants/employees`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });

    const data = await response.json() as VagaroEmployeesResponse;
    
    if (data.status !== 200 || !data.data?.employees) {
      throw new Error(data.message || "Failed to get employees from Vagaro");
    }

    return data.data.employees;
  }
}
