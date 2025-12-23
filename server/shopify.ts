import type { Settings } from "@shared/schema";

export interface ShopifyDraftOrderInput {
  customerEmail?: string;
  customerName: string;
  customerPhone?: string;
  lineItems: Array<{
    variantId?: string;
    title: string;
    price: string;
    quantity: number;
    taxable?: boolean;
  }>;
  tags?: string[];
  note?: string;
  stylistName?: string;
  stylistId?: string;
}

export interface ShopifyCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
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

  async searchCustomer(name: string, phone?: string): Promise<ShopifyCustomer | null> {
    const query = `
      query searchCustomers($query: String!) {
        customers(first: 10, query: $query) {
          nodes {
            id
            firstName
            lastName
            email
            phone
          }
        }
      }
    `;

    // Search by phone first if available, then by name
    let searchQuery = phone ? `phone:${phone}` : `name:${name}`;
    
    const variables = { query: searchQuery };
    const result = await this.request("", "POST", { query, variables });
    
    const customers = result.data?.customers?.nodes || [];
    
    if (customers.length === 0 && phone) {
      // Try searching by name if phone search fails
      const nameVariables = { query: `name:${name}` };
      const nameResult = await this.request("", "POST", { query, variables: nameVariables });
      const nameCustomers = nameResult.data?.customers?.nodes || [];
      
      if (nameCustomers.length > 0) {
        const customer = nameCustomers[0];
        return {
          id: customer.id,
          firstName: customer.firstName || "",
          lastName: customer.lastName || "",
          email: customer.email,
          phone: customer.phone,
        };
      }
      return null;
    }
    
    if (customers.length === 0) {
      return null;
    }

    const customer = customers[0];
    return {
      id: customer.id,
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      email: customer.email,
      phone: customer.phone,
    };
  }

  async createCustomer(name: string, email?: string, phone?: string): Promise<ShopifyCustomer> {
    const mutation = `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            firstName
            lastName
            email
            phone
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Split name into first and last name
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(" ") || "";

    const input: any = {
      firstName,
      lastName,
    };
    
    if (email) {
      input.email = email;
    }
    if (phone) {
      input.phone = phone;
    }

    const variables = { input };
    const result = await this.request("", "POST", { query: mutation, variables });

    if (result.data?.customerCreate?.userErrors?.length > 0) {
      console.log("Customer creation warning:", result.data.customerCreate.userErrors[0].message);
      // If customer creation fails (e.g., duplicate), try to find existing
      const existing = await this.searchCustomer(name, phone);
      if (existing) {
        return existing;
      }
      // Return a placeholder if we can't create or find
      throw new Error(`Could not create customer: ${result.data.customerCreate.userErrors[0].message}`);
    }

    const customer = result.data.customerCreate.customer;
    return {
      id: customer.id,
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      email: customer.email,
      phone: customer.phone,
    };
  }

  async findOrCreateCustomer(name: string, email?: string, phone?: string): Promise<ShopifyCustomer | null> {
    // First try to find existing customer
    const existing = await this.searchCustomer(name, phone);
    if (existing) {
      return existing;
    }

    // If not found and we have either email or phone, create new customer
    if (email || phone) {
      try {
        return await this.createCustomer(name, email, phone);
      } catch (error) {
        console.log("Could not create customer, proceeding without:", error);
        return null;
      }
    }

    return null;
  }

  async createServiceProduct(title: string, price: string, tags: string[] = []): Promise<ShopifyProduct> {
    const mutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            tags
            variants(first: 1) {
              nodes {
                id
                title
                price
                inventoryItem {
                  id
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Create a URL-safe handle from the title
    const handle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-service';

    const productTags = ['vagaro-sync', 'service', ...tags];

    const variables = {
      input: {
        title: title,
        handle: handle,
        productType: "Service",
        vendor: "Vagaro",
        tags: productTags,
        status: "ACTIVE",
        variants: [{
          price: price,
          requiresShipping: false,
          taxable: false,
          inventoryPolicy: "CONTINUE",
          inventoryManagement: null,
        }],
      },
    };

    const result = await this.request("", "POST", { query: mutation, variables });

    if (result.data?.productCreate?.userErrors?.length > 0) {
      const error = result.data.productCreate.userErrors[0];
      // If product already exists (handle taken), try to find it
      if (error.message.includes('handle') || error.message.includes('already')) {
        console.log(`[Shopify] Product with handle "${handle}" may exist, searching...`);
        const existing = await this.searchProductByTitle(title);
        if (existing) {
          return existing;
        }
      }
      throw new Error(`Shopify product creation failed: ${error.message}`);
    }

    const product = result.data.productCreate.product;
    
    // Disable inventory tracking on the variant's inventory item
    if (product.variants?.nodes?.[0]?.inventoryItem?.id) {
      await this.disableInventoryTracking(product.variants.nodes[0].inventoryItem.id);
    }

    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      tags: product.tags || [],
      variants: (product.variants?.nodes || []).map((v: any) => ({
        id: v.id,
        title: v.title || "Default",
        price: v.price,
        sku: "",
      })),
    };
  }

  async disableInventoryTracking(inventoryItemId: string): Promise<void> {
    const mutation = `
      mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
        inventoryItemUpdate(id: $id, input: $input) {
          inventoryItem {
            id
            tracked
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      id: inventoryItemId,
      input: {
        tracked: false,
      },
    };

    try {
      await this.request("", "POST", { query: mutation, variables });
      console.log(`[Shopify] Disabled inventory tracking for ${inventoryItemId}`);
    } catch (error) {
      console.log(`[Shopify] Could not disable inventory tracking: ${error}`);
    }
  }

  async ensureServiceProduct(title: string, price: string, tags: string[] = []): Promise<ShopifyProduct> {
    // First try to find existing product
    const existing = await this.searchProductByTitle(title);
    if (existing) {
      console.log(`[Shopify] Found existing product: ${existing.title}`);
      return existing;
    }

    // Create new service product if not found
    console.log(`[Shopify] Creating new service product: ${title}`);
    return await this.createServiceProduct(title, price, tags);
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

    // Find or create customer in Shopify
    let customerId: string | undefined;
    try {
      const customer = await this.findOrCreateCustomer(
        input.customerName,
        input.customerEmail,
        input.customerPhone
      );
      if (customer) {
        customerId = customer.id;
      }
    } catch (error) {
      console.log("Customer lookup/creation failed, proceeding without customer:", error);
    }

    // Build line items - set taxable: false for custom items (no variantId)
    const lineItems = input.lineItems.map(item => {
      if (item.variantId) {
        return {
          variantId: item.variantId,
          quantity: item.quantity,
        };
      }
      // Custom line item (product not found) - set tax to 0
      return {
        title: item.title,
        originalUnitPrice: item.price,
        quantity: item.quantity,
        taxable: false,
      };
    });

    const customAttributes: Array<{key: string, value: string}> = [];
    if (input.stylistName) {
      customAttributes.push({ key: "stylist_name", value: input.stylistName });
    }
    if (input.stylistId) {
      customAttributes.push({ key: "stylist_id", value: input.stylistId });
    }

    // Check if any line items have variants (are reservable)
    const hasReservableItems = input.lineItems.some(item => item.variantId);

    const draftOrderInput: any = {
      note: input.note,
      tags: input.tags || [],
      lineItems,
      customAttributes: customAttributes.length > 0 ? customAttributes : undefined,
    };

    // Only reserve inventory if there are actual products with variants
    if (hasReservableItems) {
      const reserveUntil = new Date();
      reserveUntil.setHours(reserveUntil.getHours() + 24);
      draftOrderInput.reserveInventoryUntil = reserveUntil.toISOString();
    }

    // Attach customer using email or customer ID (not B2B purchasingEntity)
    if (customerId) {
      draftOrderInput.customerId = customerId;
    } else if (input.customerEmail) {
      draftOrderInput.email = input.customerEmail;
    }

    const variables = { input: draftOrderInput };

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
