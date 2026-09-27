interface Contact {
	name: string;
	link: string;
	label: string;
	big?: boolean;
}

export const contacts: Contact[] = [
	{
		name: "@eitaar",
		link: "https://github.com/eitaar",
		label: "GitHub",
	},
	{
		name: "@eitaar0",
		link: "https://x.com/eitaar0",
		label: "X (Twitter)",
	},
	{
		name: "hi@eitaar.dev",
		link: "mailto:hi@eitaar.dev",
		label: "Email",
		big: true,
	},
	{
		name: "@eitaar",
		link: "https://discord.gg/RBtJFtTF",
		label: "Discord",
	},
	{
		name: "@eitaar:matrix.org",
		link: "https://matrix.to/#/@eitaar:matrix.org",
		label: "Matrix",
	},
];
