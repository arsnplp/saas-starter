import { z } from 'zod';
import { TeamDataWithMembers, User } from '@/lib/db/schema';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';

export type ActionState = {
  error?: string;
  success?: string;
  [key: string]: any; // This allows for additional properties
};

type ValidatedActionFunction<S extends z.ZodType<any, any>, T> = (
  data: z.infer<S>,
  formData: FormData
) => Promise<T>;

export function validatedAction<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: ValidatedActionFunction<S, T>
) {
  return async (prevState: ActionState, formData: FormData) => {
    const result = schema.safeParse(Object.fromEntries(formData));
    if (!result.success) {
      return { error: result.error.errors[0].message };
    }

    return action(result.data, formData);
  };
}

type ValidatedActionWithUserFunction<S extends z.ZodType<any, any>, T> = (
  data: z.infer<S>,
  formData: FormData,
  user: User
) => Promise<T>;

export function validatedActionWithUser<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: ValidatedActionWithUserFunction<S, T>
) {
  return async (prevState: ActionState | any, formData?: FormData | any) => {
    const user = await getUser();
    if (!user) {
      throw new Error('User is not authenticated');
    }

    // Handle both FormData (from forms) and plain objects (from client-side calls)
    let dataToValidate: any;
    let originalFormData: FormData | undefined;
    
    if (formData instanceof FormData) {
      // Traditional form submission
      dataToValidate = Object.fromEntries(formData);
      originalFormData = formData;
    } else if (typeof prevState === 'object' && prevState !== null && !prevState.error && !prevState.success) {
      // Direct function call with object (e.g., from client component)
      dataToValidate = prevState;
      originalFormData = undefined;
    } else {
      // Form submission case where prevState is ActionState
      dataToValidate = formData ? Object.fromEntries(formData as FormData) : {};
      originalFormData = formData as FormData;
    }

    const result = schema.safeParse(dataToValidate);
    if (!result.success) {
      return { error: result.error.errors[0].message };
    }

    return action(result.data, originalFormData as FormData, user);
  };
}

type ActionWithTeamFunction<T> = (
  formData: FormData,
  team: TeamDataWithMembers
) => Promise<T>;

export function withTeam<T>(action: ActionWithTeamFunction<T>) {
  return async (formData: FormData): Promise<T> => {
    const user = await getUser();
    if (!user) {
      redirect('/sign-in');
    }

    const team = await getTeamForUser();
    if (!team) {
      throw new Error('Team not found');
    }

    return action(formData, team);
  };
}
