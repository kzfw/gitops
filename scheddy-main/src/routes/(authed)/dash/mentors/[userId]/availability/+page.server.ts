import { loadUserData } from '$lib/userInfo';
import { roleOf } from '$lib';
import { ROLE_STAFF } from '$lib/utils';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { fail, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { MentorAvailability } from '$lib/availability';
import { availSchema } from './availSchema';

export const load: PageServerLoad = async ({ cookies, params }) => {
	const { user } = (await loadUserData(cookies))!;
	if (roleOf(user) < ROLE_STAFF && user.id != params.userId) {
		redirect(307, '/schedule');
	}

	const mentor = await db
		.select()
		.from(users)
		.where(eq(users.id, Number.parseInt(params.userId!)));

	if (!mentor || mentor.length === 0) {
		redirect(307, '/dash');
	}

	const availability: MentorAvailability | null = mentor[0].mentorAvailability
		? JSON.parse(mentor[0].mentorAvailability)
		: null;

	const form = await superValidate(
		{ timezone: mentor[0].timezone, ...availability },
		zod(availSchema)
	);

	return {
		user,
		mentor: mentor[0],
		form
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod(availSchema));

		const { user } = (await loadUserData(event.cookies))!;
		if (roleOf(user) < ROLE_STAFF && user.id != event.params.userId) {
			return fail(403, { form });
		}
		if (!form.valid) {
			return fail(400, { form });
		}

		const schedule = JSON.stringify(form.data);

		await db
			.update(users)
			.set({
				mentorAvailability: schedule,
				timezone: form.data.timezone
			})
			.where(eq(users.id, event.params.userId));

		return { form };
	}
};
