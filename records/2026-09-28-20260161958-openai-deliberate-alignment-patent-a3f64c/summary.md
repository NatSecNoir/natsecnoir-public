The patent application discloses methods for training and operating language models that reason over learned policies to choose compliant responses, refusals, or modified completions.

**What it does** The application describes synthetic generation of `(prompt, chain-of-thought, response)` tuples using prompts and policy text, evaluation and filtering by a policy-aware reward model, supervised fine-tuning, and subsequent reinforcement learning. The resulting reasoning-capable model may apply policy principles during inference without receiving the policy text in the prompt. For a given request, it can provide a direct answer, refuse while citing the policy, or produce a policy-compliant completion that withholds disallowed material while remaining helpful. The disclosure also describes moderation, governance, evaluation, and machine-learning system components.

**Who it affects** The disclosed technology primarily concerns OpenAI OpCo, LLC and developers or operators of generative AI systems, including users interacting through conversational interfaces and APIs. It is framed for safety and compliance policies covering areas such as illicit behavior, self-harm, harassment or hate speech, extremism, defamation, personal data, regulated advice, copyright, sexual content, and political interference.

**Why it matters** The application presents policy-aware reasoning as an alternative or supplement to external runtime safety checks. It claims potential gains in policy adherence, robustness to adversarial prompts, interpretability, data efficiency, latency, and training efficiency, while emphasizing that internal reasoning may remain hidden from users.

**Key dates and numbers**
- Published June 11, 2026, as US 2026/0161958 A1.
- Application No. 19/379,423; filed November 4, 2025.
- Claims priority to provisional application No. 63/730,823, filed December 11, 2024.
- The disclosure identifies three principal inference outcomes: response, refusal, or policy-compliant completion.
- Embodiment 12 claims a training pipeline combining tuple evaluation and filtering, supervised fine-tuning, and reinforcement learning.
