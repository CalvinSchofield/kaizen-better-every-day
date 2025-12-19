/**
 * Generates a stage-specific help message for texting the leader/recruiter about a recruit
 */
export const generateStageHelpMessage = (
  recruitFirstName: string,
  stage: string | null,
  contactRole: 'leader' | 'recruiter' = 'recruiter'
): string => {
  const stageNormalized = stage?.toLowerCase() || '';
  
  // 100 List - Ask for info and introduction
  if (stageNormalized.includes('100') || stageNormalized === '100_list') {
    return `Hey! I saw ${recruitFirstName} is on the 100 list. Can you tell me a bit about them? How do you know them and what's the best way to reach out?`;
  }
  
  // Reached Out - Help getting in touch
  if (stageNormalized.includes('reached') || stageNormalized === 'reached_out') {
    return `Hey! I've been trying to get in touch with ${recruitFirstName}. Any tips on the best way to reach them or anything I should know before we connect?`;
  }
  
  // Evaluating - Next steps to move them forward
  if (stageNormalized.includes('evaluat')) {
    return `Hey! ${recruitFirstName} is in the evaluating stage. What do you think would be the best next step to help them move forward?`;
  }
  
  // Signed - Help get them ready for blitz/summer
  if (stageNormalized === 'signed' || stageNormalized.includes('signed')) {
    return `Hey! ${recruitFirstName} just signed! How can I help get them ready and prepped for blitz or the summer?`;
  }
  
  // Shadow Complete - Help prep for selling
  if (stageNormalized.includes('shadow') || stageNormalized === 'shadow_complete') {
    return `Hey! ${recruitFirstName} finished their shadow! How can I help them prep for their next chance to knock and get a sale?`;
  }
  
  // Sold - Help them hit 5+
  if (stageNormalized === 'sold') {
    return `Hey! ${recruitFirstName} got their first sale! What can I do to help them sell 5+ before summer?`;
  }
  
  // Sold 5+ - Help with recruiting and understanding recruiter pay
  if (stageNormalized.includes('5+') || stageNormalized.includes('5 plus') || stageNormalized === 'sold_5_plus') {
    return `Hey! ${recruitFirstName} hit 5+ sales! I want to help them start recruiting and understand how recruiter pay works. Any tips?`;
  }
  
  // Default fallback
  return `Hey! What can I do to help ${recruitFirstName} move forward?`;
};
