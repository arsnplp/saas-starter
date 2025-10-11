'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { linkedinConnections } from '@/lib/db/schema';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { getTeamForUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const LINKUP_API_BASE_URL = 'https://api.linkupapi.com/v1';

const connectLinkedinSchema = z.object({
  email: z.string().email('Email LinkedIn invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

const verifyLinkedinCodeSchema = z.object({
  email: z.string().email('Email LinkedIn invalide'),
  code: z.string().min(1, 'Code de vérification requis'),
  country: z.string().default('FR'),
});

export const connectLinkedin = validatedActionWithUser(
  connectLinkedinSchema,
  async (data, _, user) => {
    try {
      const team = await getTeamForUser();
      
      if (!team) {
        return { 
          error: '', 
          success: '', 
          needsVerification: true,
          message: 'Erreur: Équipe non trouvée. Veuillez contacter le support.' 
        };
      }

      const apiKey = process.env.LINKUP_API_KEY;
      if (!apiKey) {
        return { 
          error: '', 
          success: '', 
          needsVerification: true,
          message: 'Erreur de configuration: LINKUP_API_KEY manquante. Veuillez contacter le support.' 
        };
      }

      const response = await fetch(`${LINKUP_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          country: 'FR',
        }),
      });

      const result = await response.json().catch(() => null);

      if (!result) {
        return { 
          error: '', 
          success: '',
          needsVerification: true,
          message: `Réponse invalide de LinkedIn (${response.status}). Veuillez essayer avec le code de vérification.`
        };
      }

      if (result.login_token) {
        const existing = await db.query.linkedinConnections.findFirst({
          where: eq(linkedinConnections.teamId, team.id),
        });

        if (existing) {
          await db
            .update(linkedinConnections)
            .set({
              loginToken: result.login_token,
              linkedinEmail: data.email,
              connectedBy: user.id,
              connectedAt: new Date(),
              isActive: true,
            })
            .where(eq(linkedinConnections.teamId, team.id));
        } else {
          await db.insert(linkedinConnections).values({
            teamId: team.id,
            loginToken: result.login_token,
            linkedinEmail: data.email,
            connectedBy: user.id,
            isActive: true,
          });
        }

        revalidatePath('/dashboard/integrations');
        
        return { 
          error: '', 
          success: 'LinkedIn connecté avec succès ! Vous pouvez maintenant importer des leads.',
          needsVerification: false
        };
      }

      return { 
        error: '', 
        success: '', 
        needsVerification: true,
        message: result.message || 'Un code de vérification a été envoyé à votre email LinkedIn'
      };
    } catch (error) {
      console.error('LinkedIn connection error:', error);
      return { 
        error: '', 
        success: '',
        needsVerification: true,
        message: error instanceof Error ? error.message : 'Erreur réseau. Veuillez réessayer avec le code de vérification.'
      };
    }
  }
);

export const verifyLinkedinCode = validatedActionWithUser(
  verifyLinkedinCodeSchema,
  async (data, _, user) => {
    try {
      const team = await getTeamForUser();
      
      if (!team) {
        return { error: 'Équipe non trouvée', success: '' };
      }

      const apiKey = process.env.LINKUP_API_KEY;
      if (!apiKey) {
        return { error: 'LINKUP_API_KEY non configurée', success: '' };
      }

      const response = await fetch(`${LINKUP_API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          email: data.email,
          code: data.code,
          country: data.country,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { 
          error: `Code de vérification invalide: ${response.status} - ${errorText}`, 
          success: '' 
        };
      }

      const result = await response.json();

      if (!result.login_token) {
        return { error: 'Token de connexion non reçu après vérification', success: '' };
      }

      const existing = await db.query.linkedinConnections.findFirst({
        where: eq(linkedinConnections.teamId, team.id),
      });

      if (existing) {
        await db
          .update(linkedinConnections)
          .set({
            loginToken: result.login_token,
            linkedinEmail: data.email,
            connectedBy: user.id,
            connectedAt: new Date(),
            isActive: true,
          })
          .where(eq(linkedinConnections.teamId, team.id));
      } else {
        await db.insert(linkedinConnections).values({
          teamId: team.id,
          loginToken: result.login_token,
          linkedinEmail: data.email,
          connectedBy: user.id,
          isActive: true,
        });
      }

      revalidatePath('/dashboard/integrations');
      
      return { 
        error: '', 
        success: 'LinkedIn connecté avec succès ! Vous pouvez maintenant importer des leads.' 
      };
    } catch (error) {
      console.error('LinkedIn verification error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Erreur lors de la vérification', 
        success: '' 
      };
    }
  }
);

export const disconnectLinkedin = validatedActionWithUser(
  z.object({}),
  async (data, _, user) => {
    try {
      const team = await getTeamForUser();
      
      if (!team) {
        return { error: 'Équipe non trouvée', success: '' };
      }

      await db
        .delete(linkedinConnections)
        .where(eq(linkedinConnections.teamId, team.id));

      revalidatePath('/dashboard/integrations');

      return { error: '', success: 'LinkedIn déconnecté' };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Erreur lors de la déconnexion', 
        success: '' 
      };
    }
  }
);
