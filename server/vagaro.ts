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
  private businessId: string;
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
      throw new Error("Vagaro Business ID not configured");
    }
    
    this.baseUrl = `https://api.vagaro.com/public/v2`;
    this.clientId = settings.vagaroClientId;
    this.clientSecret = settings.vagaroClientSecret;
    this.businessId = settings.vagaroMerchantId;
    
    console.log(`[Vagaro] Initialized client with businessId: ${this.businessId}, baseUrl: ${this.baseUrl}`);
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const url = `${this.baseUrl}/token`;
    const body = {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      businessId: this.businessId,
    };
    
    console.log(`[Vagaro] Requesting access token from: ${url}`);
    console.log(`[Vagaro] Token request body:`, JSON.stringify({ ...body, clientSecret: "***" }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    console.log(`[Vagaro] Token raw response (status ${response.status}):`, rawText.substring(0, 500));
    
    if (!rawText || rawText.trim() === '') {
      throw new Error(`Vagaro auth failed: Empty response (HTTP ${response.status})`);
    }
    
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Vagaro auth failed: Invalid JSON response - ${rawText.substring(0, 200)}`);
    }
    
    console.log(`[Vagaro] Token response:`, JSON.stringify(data).substring(0, 300));
    
    const token = data.access_token || data.data?.access_token || data.token;
    if (!token) {
      const errorDetails = data.errors ? JSON.stringify(data.errors) : (data.message || JSON.stringify(data));
      throw new Error(`Vagaro auth failed: ${errorDetails}`);
    }

    this.accessToken = token;
    console.log(`[Vagaro] Successfully obtained access token`);
    return this.accessToken;
  }

  async getEmployees(): Promise<VagaroEmployee[]> {
    const token = await this.getAccessToken();
    
    const url = `${this.baseUrl}/businesses/${this.businessId}/employees`;
    console.log(`[Vagaro] Fetching employees from: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });

    const rawText = await response.text();
    console.log(`[Vagaro] Employees response (status ${response.status}):`, rawText.substring(0, 500));
    
    if (!rawText || rawText.trim() === '') {
      throw new Error(`Vagaro API returned empty response (HTTP ${response.status}). Please verify your Business ID and API credentials.`);
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Vagaro API returned invalid JSON: ${rawText.substring(0, 200)}`);
    }
    
    console.log(`[Vagaro] Employees parsed response:`, JSON.stringify(data).substring(0, 300));
    
    const employees = data.employees || data.data?.employees || data.serviceProviders || data.data;
    
    if (data.errors) {
      console.log(`[Vagaro] Employees errors:`, JSON.stringify(data.errors));
      throw new Error(`Vagaro API error: ${JSON.stringify(data.errors)}`);
    }
    
    if (!employees || !Array.isArray(employees)) {
      throw new Error(`Failed to get employees: ${data.message || 'No employees data returned'}`);
    }

    console.log(`[Vagaro] Found ${employees.length} employees`);
    return employees;
  }
}
