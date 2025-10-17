import { LinkedInOAuthService } from './linkedin-oauth';

interface PublishPostParams {
  teamId: number;
  content: string;
  imageUrl?: string;
}

interface LinkedInPostResponse {
  id: string;
  activityUrn?: string;
}

export class LinkedInPublisher {
  static async publishPost(params: PublishPostParams): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
      const { teamId, content, imageUrl } = params;

      const accessToken = await LinkedInOAuthService.getValidAccessToken(teamId);

      if (!accessToken) {
        return { success: false, error: 'OAuth LinkedIn non configuré pour cette équipe' };
      }

      const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!profileResponse.ok) {
        return { success: false, error: 'Impossible de récupérer le profil LinkedIn' };
      }

      const profileData = await profileResponse.json();
      const personUrn = `urn:li:person:${profileData.sub}`;

      const postData: any = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      if (imageUrl) {
        const uploadedImageUrn = await this.uploadImage(accessToken, personUrn, imageUrl);
        
        if (uploadedImageUrn) {
          postData.specificContent['com.linkedin.ugc.ShareContent'].media = [
            {
              status: 'READY',
              originalUrl: imageUrl,
              media: uploadedImageUrn,
            },
          ];
        }
      }

      const publishResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(postData),
      });

      if (!publishResponse.ok) {
        const errorText = await publishResponse.text();
        console.error('LinkedIn publish error:', errorText);
        return { success: false, error: `Erreur LinkedIn: ${publishResponse.status}` };
      }

      const result: LinkedInPostResponse = await publishResponse.json();
      const postId = result.id || result.activityUrn?.split(':').pop();

      return { success: true, postId };
    } catch (error: any) {
      console.error('Error publishing to LinkedIn:', error);
      return { success: false, error: error.message || 'Erreur lors de la publication' };
    }
  }

  private static async uploadImage(
    accessToken: string,
    personUrn: string,
    imageUrl: string
  ): Promise<string | null> {
    try {
      const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: personUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        }),
      });

      if (!registerResponse.ok) {
        console.error('Image registration failed');
        return null;
      }

      const registerData = await registerResponse.json();
      const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const asset = registerData.value.asset;

      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: imageBlob,
      });

      if (!uploadResponse.ok) {
        console.error('Image upload failed');
        return null;
      }

      return asset;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  }
}
