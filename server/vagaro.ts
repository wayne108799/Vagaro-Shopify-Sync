interface VagaroTokenResponse {
  status: number;
  responseCode: number;
  message: string;
  data?: {
    access_token: string;
    expires_in: number;
  };
  errors?: Record<string, string>;
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
  errors?: Record<string, string>;
}

export class VagaroClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private merchantId: string;
  private accessToken: string | null = null;

  constructor(settings: {
    vagaroClientId: string | null;
    vagaroClientSecret: string | null;
    vagaroMerchantId: string | null;
    vagaroRegion: string | null;
  }) {
    if (!settings.vagaroClientId || !settings.vagaroClientSecret) {
      throw new Error("Vagaro credentials not configured");
    }
    if (!settings.vagaroMerchantId) {
      throw new Error("Vagaro Merchant ID not configured");
    }
    
    const region = settings.vagaroRegion || "us";
    this.baseUrl = `https://api.vagaro.com/${region}/api/v2`;
    this.clientId = settings.vagaroClientId;
    this.clientSecret = settings.vagaroClientSecret;
    this.merchantId = settings.vagaroMerchantId;
    
    console.log(`[Vagaro] Initialized client with region: ${region}, merchantId: ${this.merchantId}, baseUrl: ${this.baseUrl}`);
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const url = `${this.baseUrl}/merchants/generate-access-token`;
    const body = {
      clientId: this.clientId,
      clientSecretKey: this.clientSecret,
      scope: "employees:read",
    };
    
    console.log(`[Vagaro] Requesting access token from: ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as VagaroTokenResponse;
    
    console.log(`[Vagaro] Token response status: ${response.status}, message: ${data.message}`);
    if (data.errors) {
      console.log(`[Vagaro] Token errors:`, JSON.stringify(data.errors));
    }
    
    if (data.status !== 200 || !data.data?.access_token) {
      const errorDetails = data.errors ? JSON.stringify(data.errors) : data.message;
      throw new Error(`Vagaro auth failed: ${errorDetails}`);
    }

    this.accessToken = data.data.access_token;
    console.log(`[Vagaro] Successfully obtained access token`);
    return this.accessToken;
  }

  async getEmployees(): Promise<VagaroEmployee[]> {
    const token = await this.getAccessToken();
    
    const url = `${this.baseUrl}/merchants/${this.merchantId}/employees`;
    console.log(`[Vagaro] Fetching employees from: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });

    const rawText = await response.text();
    console.log(`[Vagaro] Employees raw response (status ${response.status}):`, rawText.substring(0, 500));
    
    if (!rawText || rawText.trim() === '') {
      throw new Error(`Vagaro API returned empty response (HTTP ${response.status}). This may indicate an invalid Merchant ID or API permissions issue.`);
    }

    let data: VagaroEmployeesResponse;
    try {
      data = JSON.parse(rawText) as VagaroEmployeesResponse;
    } catch (e) {
      throw new Error(`Vagaro API returned invalid JSON: ${rawText.substring(0, 200)}`);
    }
    
    console.log(`[Vagaro] Employees response status: ${response.status}, message: ${data.message}`);
    if (data.errors) {
      console.log(`[Vagaro] Employees errors:`, JSON.stringify(data.errors));
    }
    
    if (data.status !== 200 || !data.data?.employees) {
      const errorDetails = data.errors ? JSON.stringify(data.errors) : data.message;
      throw new Error(`Failed to get employees: ${errorDetails}`);
    }

    console.log(`[Vagaro] Found ${data.data.employees.length} employees`);
    return data.data.employees;
  }
}
