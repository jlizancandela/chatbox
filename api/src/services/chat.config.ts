export type ChatConfig = {
	similarityThreshold: number;
};

export const chatConfig: ChatConfig = {
	similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD ?? "0.5"),
};

if (
	Number.isNaN(chatConfig.similarityThreshold) ||
	chatConfig.similarityThreshold <= 0 ||
	chatConfig.similarityThreshold > 1
) {
	throw new Error("SIMILARITY_THRESHOLD must be a number between 0 and 1");
}
