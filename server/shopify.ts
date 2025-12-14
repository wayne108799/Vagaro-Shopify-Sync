import type { Settings } from "@shared/schema";

export interface ShopifyDraftOrderInput {
  customerEmail?: string;
  customerName: string;
  lineItems: Array<{
    variantId?: string;
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

export interface ShopifyOrderInput {
  customerEmail?: string;
  customerName: string;
  lineItems: Array<{
    variantId?: string;
    title: string;
    price: string;
    quantity: number;
  }>;
  tags?: string[];
  note?: string;
  currency?: string;
}

export interface ShopifyOrder {
  id: string;
  name: string;
  financialStatus: string;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  tags: string[];
  variants: Array<{
    id: string;
    title: string;
    price: string;
    sku: string;
  }>;
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
    const url = `https://${this.storeUrl}/admin/api/2024-10/graphql.json`;
    
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

  async searchProductByTitle(title: string): Promise<ShopifyProduct | null> {
    const query = `
      query searchProducts($query: String!) {
        products(first: 10, query: $query) {
          nodes {
            id
            title
            handle
            tags
            variants(first: 5) {
              nodes {
                id
                title
                price
                sku
              }
            }
          }
        }
      }
    `;

    const variables = { query: `title:*${title}*` };
    const result = await this.request("", "POST", { query, variables });
    
    const products = result.data?.products?.nodes || [];
    
    if (products.length === 0) {
      return null;
    }

    const normalizedSearchTitle = title.toLowerCase().trim();
    let bestMatch = products[0];
    
    for (const product of products) {
      const productTitle = product.title.toLowerCase().trim();
      if (productTitle === normalizedSearchTitle) {
        bestMatch = product;
        break;
      }
      if (productTitle.includes(normalizedSearchTitle) || normalizedSearchTitle.includes(productTitle)) {
        bestMatch = product;
      }
    }

    return {
      id: bestMatch.id,
      title: bestMatch.title,
      handle: bestMatch.handle,
      tags: bestMatch.tags || [],
      variants: (bestMatch.variants?.nodes || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        price: v.price,
        sku: v.sku || "",
      })),
    };
  }

  async createOrder(input: ShopifyOrderInput): Promise<ShopifyOrder> {
    const mutation = `
      mutation orderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) {
          order {
            id
            name
            displayFinancialStatus
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const lineItems = input.lineItems.map(item => {
      if (item.variantId) {
        return {
          variantId: item.variantId,
          quantity: item.quantity,
        };
      }
      return {
        title: item.title,
        quantity: item.quantity,
        priceSet: {
          shopMoney: {
            amount: item.price,
            currencyCode: input.currency || "USD",
          },
        },
      };
    });

    const totalAmount = input.lineItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);

    const variables = {
      order: {
        lineItems,
        note: input.note,
        tags: input.tags || [],
        email: input.customerEmail,
        financialStatus: "PAID",
        transactions: [
          {
            kind: "SALE",
            status: "SUCCESS",
            amountSet: {
              shopMoney: {
                amount: totalAmount.toFixed(2),
                currencyCode: input.currency || "USD",
              },
            },
            gateway: "cash",
          },
        ],
      },
      options: {
        inventoryBehaviour: "DECREMENT_OBEYING_POLICY",
      },
    };

    const result = await this.request("", "POST", { query: mutation, variables });

    if (result.data?.orderCreate?.userErrors?.length > 0) {
      throw new Error(`Shopify order creation failed: ${result.data.orderCreate.userErrors[0].message}`);
    }

    if (!result.data?.orderCreate?.order) {
      throw new Error(`Shopify order creation failed: No order returned`);
    }

    // Extract numeric ID from GraphQL global ID (gid://shopify/Order/123 -> 123)
    const gid = result.data.orderCreate.order.id;
    const numericId = gid.split('/').pop() || gid;

    return {
      id: numericId,
      name: result.data.orderCreate.order.name,
      financialStatus: result.data.orderCreate.order.displayFinancialStatus,
    };
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

    const lineItems = input.lineItems.map(item => {
      if (item.variantId) {
        return {
          variantId: item.variantId,
          quantity: item.quantity,
        };
      }
      return {
        title: item.title,
        originalUnitPrice: item.price,
        quantity: item.quantity,
      };
    });

    const variables = {
      input: {
        email: input.customerEmail,
        note: input.note,
        tags: input.tags || [],
        lineItems,
      },
    };

    const result = await this.request("", "POST", { query: mutation, variables });

    if (result.data?.draftOrderCreate?.userErrors?.length > 0) {
      throw new Error(`Shopify draft order creation failed: ${result.data.draftOrderCreate.userErrors[0].message}`);
    }

    // Extract numeric ID from GraphQL global ID for consistency
    const gid = result.data.draftOrderCreate.draftOrder.id;
    const numericId = gid.split('/').pop() || gid;

    return {
      id: numericId,
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

    // Convert numeric ID to GraphQL global ID if needed
    const gid = orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
    const variables = { id: gid };
    const result = await this.request("", "POST", { query, variables });
    
    return result.data?.order;
  }
}
