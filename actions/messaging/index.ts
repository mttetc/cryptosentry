'use server';

// Export all messaging functions
export {
  makeCall,
  sendSMS,
  validateWebhook,
  handleCallWebhook
} from './providers/bulkvs';  // Using BulkVS as the default provider

// You can switch providers by changing the import above to './providers/twilio'
// Or implement provider selection logic based on configuration if needed 