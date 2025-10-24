#!/usr/bin/env node

/**
 * Product Import Script
 * 
 * This script imports all products from your Shopify store to your database.
 * Run this after setting up your environment variables and deploying the services.
 * 
 * Usage:
 *   node import-products.js
 * 
 * Prerequisites:
 *   1. Deploy the product-manager service
 *   2. Set up environment variables (SHOP_DOMAIN, etc.)
 *   3. Ensure you have valid Shopify access tokens
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SHOP_DOMAIN = process.env.SHOP_DOMAIN || 'don-stefani-demo-store.myshopify.com';
const PRODUCT_MANAGER_URL = process.env.PRODUCT_MANAGER_URL || 'https://your-product-manager-url.amazonaws.com/graphql';

// GraphQL mutation for syncing products
const SYNC_MUTATION = `
  mutation SyncAllProducts($shopDomain: String!) {
    syncAllProducts(shopDomain: $shopDomain) {
      success
      message
      imported
      updated
      errors
      details {
        action
        shopifyId
        title
        error
      }
    }
  }
`;

async function importProducts() {
  console.log('🚀 Starting product import process...');
  console.log(`📦 Shop Domain: ${SHOP_DOMAIN}`);
  console.log(`🔗 Product Manager URL: ${PRODUCT_MANAGER_URL}`);
  console.log('');

  try {
    // Make the GraphQL request
    const response = await fetch(PRODUCT_MANAGER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: SYNC_MUTATION,
        variables: {
          shopDomain: SHOP_DOMAIN,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors);
      return;
    }

    const syncResult = result.data.syncAllProducts;
    
    console.log('📊 Import Results:');
    console.log(`   Success: ${syncResult.success ? '✅' : '❌'}`);
    console.log(`   Message: ${syncResult.message}`);
    console.log(`   Imported: ${syncResult.imported} products`);
    console.log(`   Updated: ${syncResult.updated} products`);
    console.log(`   Errors: ${syncResult.errors} products`);
    console.log('');

    if (syncResult.details && syncResult.details.length > 0) {
      console.log('📋 Detailed Results:');
      syncResult.details.forEach((detail, index) => {
        const icon = detail.action === 'imported' ? '🆕' : 
                    detail.action === 'updated' ? '🔄' : '❌';
        console.log(`   ${index + 1}. ${icon} ${detail.title} (${detail.action})`);
        if (detail.error) {
          console.log(`      Error: ${detail.error}`);
        }
      });
    }

    if (syncResult.success) {
      console.log('');
      console.log('🎉 Product import completed successfully!');
      console.log('💡 You can now view your products in the operations dashboard.');
    } else {
      console.log('');
      console.log('⚠️  Product import completed with some errors.');
      console.log('💡 Check the details above and retry if needed.');
    }

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   1. Make sure the product-manager service is deployed');
    console.log('   2. Check that PRODUCT_MANAGER_URL is correct');
    console.log('   3. Verify your Shopify access tokens are valid');
    console.log('   4. Ensure your shop domain is correct');
  }
}

// Run the import
importProducts();
