
-- Fix the prevent_duplicate_rep trigger to only fire on INSERT or when name changes
DROP TRIGGER IF EXISTS prevent_duplicate_rep_trigger ON public.reps;

CREATE TRIGGER prevent_duplicate_rep_trigger
BEFORE INSERT OR UPDATE OF name ON public.reps
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_rep();

-- Also fix the same issue on recruits table
DROP TRIGGER IF EXISTS prevent_duplicate_recruit_trigger ON public.recruits;

CREATE TRIGGER prevent_duplicate_recruit_trigger
BEFORE INSERT OR UPDATE OF name ON public.recruits
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_recruit();
