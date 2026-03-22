

# Add "Group by Office" Toggle to Structure Tab

## What Changes

A pill toggle at the top of the Structure tab lets users switch between two views:

- **Default (off)**: Pure lineage hierarchy as it exists today — Division > Partnership > Sr Region > Region > Sr MGMT Group > MGMT Group > Team. Offices are shown as non-lineage siblings under their region.
- **Group by Office (on)**: Offices become the top-level grouping. Within each office, MGMT Groups (and their teams) are shown. Sr MGMT Groups that span multiple MGMT groups within the office are preserved as intermediate groupings. Unassigned MGMT groups (no office) appear under an "Unassigned" bucket.

## UI

A small pill toggle (using the existing `Switch` component + label) placed between the Create button and the tree, reading: **"Group by Office"**. When toggled on, the tree rebuilds with offices as roots.

## File Changes

### `src/components/org/OrgStructureTree.tsx`

1. **Add state**: `const [groupByOffice, setGroupByOffice] = useState(false);`

2. **Add toggle UI** below the Create button section (~line 886):
   ```
   <div className="flex items-center gap-2 mb-3">
     <Switch checked={groupByOffice} onCheckedChange={setGroupByOffice} />
     <span className="text-xs text-muted-foreground">Group by Office</span>
   </div>
   ```

3. **Add alternate tree builder** inside the existing `tree` useMemo (after line 804, before `return topNodes`):
   - When `groupByOffice` is true, build a different tree:
     - Each office becomes a root node
     - Under each office: find all MGMT groups where `office_id` matches, group them under their Sr MGMT Group if they have one, otherwise list directly
     - Each MGMT Group shows its teams and reps as normal (reusing existing `teamNodes` function)
     - Add an "Unassigned" office node for MGMT groups with no `office_id`
   - The `groupByOffice` state is added to the useMemo dependency array

4. **Office view tree structure**:
   ```text
   Office A (AD: Calvin Schofield)
   ├── Sr MGMT Group X
   │   ├── MGMT Group 1
   │   │   └── Team Alpha
   │   └── MGMT Group 2
   │       └── Team Beta
   └── MGMT Group 3 (no sr_mgmt_group)
       └── Team Gamma
   
   Office B (AD: ...)
   └── ...
   
   No Office Assigned
   └── MGMT Group 4
       └── Team Delta
   ```

## Technical Details

- The office view reuses all existing node-building functions (`teamNodes`, `mgmtNodesForSrMgmt`, `mgmtNodesForOffice`)
- No new data fetching needed — offices, office_staff, and mgmt_groups already have `office_id` relationships
- The toggle only affects tree construction, not any management actions (long-press, create, delete all work the same)
- `groupByOffice` added to the `useMemo` dependency array for `tree`

