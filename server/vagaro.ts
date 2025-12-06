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
  serviceProviderId?: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  email?: string;
}

interface VagaroLocation {
  businessId: string;
  locationId?: string;
  businessName?: string;
  address?: string;
}

export class VagaroClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private encId: string;
  private region: string;
  private accessToken: string | null = null;
  private resolvedBusinessId: string | null = null;

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
      throw new Error("Vagaro Enc ID not configured");
    }
    
    this.region = settings.vagaroRegion || "us";
    this.baseUrl = `https://api.vagaro.com/${this.region}/api/v2`;
    this.clientId = settings.vagaroClientId;
    this.clientSecret = settings.vagaroClientSecret;
    this.encId = settings.vagaroMerchantId;
    
    console.log(`[Vagaro] Initialized client with region: ${this.region}, encId: ${this.encId}, baseUrl: ${this.baseUrl}`);
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const url = `${this.baseUrl}/merchants/generate-access-token`;
    const body = {
      clientId: this.clientId,
      clientSecretKey: this.clientSecret,
      scope: "locations:read employees:read",
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
    
    console.log(`[Vagaro] Token response parsed`);
    
    const token = data.access_token || data.data?.access_token || data.token;
    if (!token) {
      const errorDetails = data.errors ? JSON.stringify(data.errors) : (data.message || JSON.stringify(data));
      throw new Error(`Vagaro auth failed: ${errorDetails}`);
    }

    this.accessToken = token;
    console.log(`[Vagaro] Successfully obtained access token`);
    return token;
  }

  async getLocations(): Promise<VagaroLocation[]> {
    const token = await this.getAccessToken();
    
    // Locations endpoint with accessToken header (per Vagaro API docs)
    const url = `${this.baseUrl}/locations?pageNumber=1&pageSize=25`;
    console.log(`[Vagaro] Fetching locations from: ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "accessToken": token,
      },
    });

    let rawText = await response.text();
    console.log(`[Vagaro] Locations POST response (status ${response.status}):`, rawText.substring(0, 500));
    
    if (!rawText || rawText.trim() === '') {
      throw new Error(`Vagaro API returned empty response for locations (HTTP ${response.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Vagaro API returned invalid JSON: ${rawText.substring(0, 200)}`);
    }
    
    console.log(`[Vagaro] Locations parsed response:`, JSON.stringify(data).substring(0, 500));
    
    const locations = data.locations || data.data?.locations || data.data || [];
    
    if (data.errors) {
      console.log(`[Vagaro] Locations errors:`, JSON.stringify(data.errors));
      throw new Error(`Vagaro API error: ${JSON.stringify(data.errors)}`);
    }
    
    if (!Array.isArray(locations)) {
      console.log(`[Vagaro] Locations data is not an array, returning full response`);
      return [data];
    }

    console.log(`[Vagaro] Found ${locations.length} locations`);
    return locations;
  }

  async getBusinessId(): Promise<string> {
    if (this.resolvedBusinessId) {
      return this.resolvedBusinessId;
    }

    // Get businessId from locations endpoint
    const locations = await this.getLocations();
    
    console.log(`[Vagaro] Locations data for businessId:`, JSON.stringify(locations).substring(0, 500));
    
    if (locations.length === 0) {
      throw new Error("No locations found. Please verify your Vagaro credentials and scope.");
    }
    
    // Try to extract businessId from various possible field names
    const location = locations[0];
    const businessId = location.businessId || 
                       location.locationId || 
                       (location as any).business_id ||
                       (location as any).id ||
                       (location as any).businessID;
    
    if (!businessId) {
      console.log(`[Vagaro] Full location object:`, JSON.stringify(location));
      throw new Error("Could not extract Business ID from locations response. Check API response structure.");
    }
    
    this.resolvedBusinessId = businessId;
    console.log(`[Vagaro] Resolved Business ID: ${businessId}`);
    return businessId;
  }

  async getEmployees(): Promise<VagaroEmployee[]> {
    const token = await this.getAccessToken();
    const businessId = await this.getBusinessId();
    
    const url = `${this.baseUrl}/merchants/${businessId}/employees`;
    console.log(`[Vagaro] Fetching employees from: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "accessToken": token,
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
