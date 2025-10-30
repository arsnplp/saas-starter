import { getGmailClient } from '@/lib/integrations/gmail';
import { db } from '@/lib/db/drizzle';
import { prospectCandidates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface ProspectData {
  name: string | null;
  company: string | null;
  title: string | null;
  location: string | null;
  email: string | null;
  profileUrl: string;
}

export class EmailService {
  private replaceVariables(template: string, prospect: ProspectData): string {
    return template
      .replace(/\{\{name\}\}/g, prospect.name || 'there')
      .replace(/\{\{company\}\}/g, prospect.company || 'your company')
      .replace(/\{\{title\}\}/g, prospect.title || 'your role')
      .replace(/\{\{location\}\}/g, prospect.location || 'your location')
      .replace(/\{\{email\}\}/g, prospect.email || '');
  }

  async sendCampaignEmail(
    teamId: number,
    prospectId: string,
    emailConfig: EmailTemplate
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const prospect = await db.query.prospectCandidates.findFirst({
        where: eq(prospectCandidates.id, prospectId),
      });

      if (!prospect) {
        return { success: false, error: 'Prospect not found' };
      }

      if (!prospect.email) {
        return { success: false, error: 'Prospect has no email address' };
      }

      const prospectData: ProspectData = {
        name: prospect.name,
        company: prospect.company,
        title: prospect.title,
        location: prospect.location,
        email: prospect.email,
        profileUrl: prospect.profileUrl,
      };

      const subject = this.replaceVariables(emailConfig.subject, prospectData);
      const body = this.replaceVariables(emailConfig.body, prospectData);

      const gmailClient = await getGmailClient(teamId);
      await gmailClient.sendEmail(prospect.email, subject, body);

      return { success: true };
    } catch (error) {
      console.error('Error sending campaign email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  extractVariables(template: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  getAvailableVariables(): string[] {
    return ['name', 'company', 'title', 'location', 'email'];
  }
}

export const emailService = new EmailService();
