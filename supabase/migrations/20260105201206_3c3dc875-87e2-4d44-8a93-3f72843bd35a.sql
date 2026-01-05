-- Function to normalize committed_blitzes format
CREATE OR REPLACE FUNCTION public.normalize_committed_blitzes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _blitz_id text;
  _blitz_record record;
  _normalized_blitzes jsonb := '[]'::jsonb;
  _item jsonb;
BEGIN
  -- Skip if null or empty array
  IF NEW.committed_blitzes IS NULL OR NEW.committed_blitzes = '[]'::jsonb THEN
    RETURN NEW;
  END IF;

  -- Process each item in the array
  FOR _item IN SELECT jsonb_array_elements(NEW.committed_blitzes)
  LOOP
    -- Check if it's a string (just an ID) vs an object
    IF jsonb_typeof(_item) = 'string' THEN
      _blitz_id := _item #>> '{}';
      
      -- Look up the blitz details
      SELECT id, name, date, end_date, location INTO _blitz_record
      FROM public.blitzes
      WHERE id::text = _blitz_id;
      
      IF _blitz_record.id IS NOT NULL THEN
        _normalized_blitzes := _normalized_blitzes || jsonb_build_object(
          'id', _blitz_record.id,
          'name', _blitz_record.name,
          'date', _blitz_record.date,
          'endDate', _blitz_record.end_date,
          'location', _blitz_record.location
        );
      END IF;
    ELSIF jsonb_typeof(_item) = 'object' THEN
      -- Already an object - check if it has endDate
      IF _item ? 'endDate' AND (_item->>'endDate') IS NOT NULL THEN
        -- Already valid, keep as-is
        _normalized_blitzes := _normalized_blitzes || _item;
      ELSIF _item ? 'id' THEN
        -- Has id but missing endDate - look up and enrich
        _blitz_id := _item->>'id';
        
        SELECT id, name, date, end_date, location INTO _blitz_record
        FROM public.blitzes
        WHERE id::text = _blitz_id;
        
        IF _blitz_record.id IS NOT NULL THEN
          _normalized_blitzes := _normalized_blitzes || jsonb_build_object(
            'id', _blitz_record.id,
            'name', COALESCE(_item->>'name', _blitz_record.name),
            'date', COALESCE(_item->>'date', _blitz_record.date::text),
            'endDate', _blitz_record.end_date,
            'location', COALESCE(_item->>'location', _blitz_record.location)
          );
        ELSE
          -- Blitz not found, keep original
          _normalized_blitzes := _normalized_blitzes || _item;
        END IF;
      ELSE
        -- Keep as-is if no id
        _normalized_blitzes := _normalized_blitzes || _item;
      END IF;
    END IF;
  END LOOP;

  NEW.committed_blitzes := _normalized_blitzes;
  RETURN NEW;
END;
$$;

-- Create trigger to normalize on insert/update
DROP TRIGGER IF EXISTS normalize_committed_blitzes_trigger ON public.reps;
CREATE TRIGGER normalize_committed_blitzes_trigger
  BEFORE INSERT OR UPDATE OF committed_blitzes ON public.reps
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_committed_blitzes();

-- Now fix all existing malformed data
DO $$
DECLARE
  _rep record;
  _blitz_id text;
  _blitz_record record;
  _normalized_blitzes jsonb;
  _item jsonb;
BEGIN
  FOR _rep IN 
    SELECT id, committed_blitzes 
    FROM public.reps 
    WHERE committed_blitzes IS NOT NULL 
      AND committed_blitzes != '[]'::jsonb
  LOOP
    _normalized_blitzes := '[]'::jsonb;
    
    FOR _item IN SELECT jsonb_array_elements(_rep.committed_blitzes)
    LOOP
      IF jsonb_typeof(_item) = 'string' THEN
        _blitz_id := _item #>> '{}';
        
        SELECT id, name, date, end_date, location INTO _blitz_record
        FROM public.blitzes
        WHERE id::text = _blitz_id;
        
        IF _blitz_record.id IS NOT NULL THEN
          _normalized_blitzes := _normalized_blitzes || jsonb_build_object(
            'id', _blitz_record.id,
            'name', _blitz_record.name,
            'date', _blitz_record.date,
            'endDate', _blitz_record.end_date,
            'location', _blitz_record.location
          );
        END IF;
      ELSIF jsonb_typeof(_item) = 'object' THEN
        IF _item ? 'endDate' AND (_item->>'endDate') IS NOT NULL THEN
          _normalized_blitzes := _normalized_blitzes || _item;
        ELSIF _item ? 'id' THEN
          _blitz_id := _item->>'id';
          
          SELECT id, name, date, end_date, location INTO _blitz_record
          FROM public.blitzes
          WHERE id::text = _blitz_id;
          
          IF _blitz_record.id IS NOT NULL THEN
            _normalized_blitzes := _normalized_blitzes || jsonb_build_object(
              'id', _blitz_record.id,
              'name', COALESCE(_item->>'name', _blitz_record.name),
              'date', COALESCE(_item->>'date', _blitz_record.date::text),
              'endDate', _blitz_record.end_date,
              'location', COALESCE(_item->>'location', _blitz_record.location)
            );
          ELSE
            _normalized_blitzes := _normalized_blitzes || _item;
          END IF;
        ELSE
          _normalized_blitzes := _normalized_blitzes || _item;
        END IF;
      END IF;
    END LOOP;
    
    -- Disable trigger temporarily to avoid double-processing
    UPDATE public.reps 
    SET committed_blitzes = _normalized_blitzes
    WHERE id = _rep.id;
  END LOOP;
END;
$$;