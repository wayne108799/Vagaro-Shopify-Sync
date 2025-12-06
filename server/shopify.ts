import type { Settings } from "@shared/schema";

export interface ShopifyDraftOrderInput {
  customerEmail?: string;
  customerName: string;
  lineItems: Array<{
    title: string;
    price: string;
    quantity: number;
  }>;
  tags?: string[];
  note?: string;
}

export interface ShopifyDraftOrder {
  id: string;
  name: string;
  invoice_url: string;
  status: string;
}

export class ShopifyClient {
  private storeUrl: string;
  private accessToken: string;

  constructor(settings: Settings) {
    if (!settings.shopifyStoreUrl || !settings.shopifyAccessToken) {
      throw new Error("Shopify credentials not configured");
    }
    this.storeUrl = settings.shopifyStoreUrl;
    this.accessToken = settings.shopifyAccessToken;
  }

  private async request(endpoint: string, method: string = "GET", body?: any) {
    const url = `https://${this.storeUrl}/admin/api/2024-01/graphql.json`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.accessToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async createDraftOrder(input: ShopifyDraftOrderInput): Promise<ShopifyDraftOrder> {
    const mutation = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            invoiceUrl
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        email: input.customerEmail,
        note: input.note,
        tags: input.tags || [],
        lineItems: input.lineItems.map(item => ({
          title: item.title,
          originalUnitPrice: item.price,
          quantity: item.quantity,
        })),
      },
    };

    const result = await this.request("", "POST", { query: mutation, variables });

    if (result.data?.draftOrderCreate?.userErrors?.length > 0) {
      throw new Error(`Shopify draft order creation failed: ${result.data.draftOrderCreate.userErrors[0].message}`);
    }

    return {
      id: result.data.draftOrderCreate.draftOrder.id,
      name: result.data.draftOrderCreate.draftOrder.name,
      invoice_url: result.data.draftOrderCreate.draftOrder.invoiceUrl,
      status: result.data.draftOrderCreate.draftOrder.status,
    };
  }

  async getOrder(orderId: string): Promise<any> {
    const query = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          totalPriceSet {
            shopMoney {
              amount
            }
          }
          currentTotalTipSet {
            shopMoney {
              amount
            }
          }
          financialStatus
        }
      }
    `;

    const variables = { id: orderId };
    const result = await this.request("", "POST", { query, variables });
    
    return result.data?.order;
  }
}