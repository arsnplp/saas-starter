import { GmailClient } from '@/lib/integrations/gmail';

export interface EmailVariables {
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  [key: string]: string | undefined;
}

/**
 * Replace variables in a template string
 * Supports {{variable}} syntax
 */
export function replaceVariables(template: string, variables: EmailVariables): string {
  let result = template;

  // Replace all {{variable}} patterns
  const variablePattern = /\{\{(\w+)\}\}/g;
  
  result = result.replace(variablePattern, (match, variableName) => {
    const value = variables[variableName];
    
    // If variable exists, use it; otherwise keep the original placeholder
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
    
    // Keep the placeholder if no value found
    return match;
  });

  return result;
}

/**
 * Send an email using Gmail API with variable substitution
 */
export async function sendEmailWithVariables(
  teamId: number,
  to: string,
  subject: string,
  body: string,
  variables: EmailVariables
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get Gmail client for the team
    const gmailClient = await GmailClient.getClient(teamId);

    // Replace variables in subject and body
    const processedSubject = replaceVariables(subject, variables);
    const processedBody = replaceVariables(body, variables);

    // Send the email
    await gmailClient.sendEmail(to, processedSubject, processedBody);

    return { success: true };
  } catch (error: any) {
    console.error('[EmailSender] Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Extract email variables from a prospect object
 */
export function extractProspectVariables(prospect: any): EmailVariables {
  return {
    name: prospect.name || '',
    firstName: prospect.firstName || prospect.name?.split(' ')[0] || '',
    lastName: prospect.lastName || prospect.name?.split(' ').slice(1).join(' ') || '',
    company: prospect.company || '',
    title: prospect.title || prospect.jobTitle || '',
    email: prospect.email || '',
    phone: prospect.phone || '',
    linkedin: prospect.linkedinUrl || prospect.linkedin || '',
  };
}
