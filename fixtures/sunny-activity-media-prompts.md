# Sunny activity image prompts

Tool: built-in imagegen. Identity reference: the golden retriever in the user-provided photo. Final selected PNGs are kept in the local workspace at `output/sunny-activities/` and uploaded to the account's private `pawsona-media` bucket. The working PNGs and original reference photo are not committed to GitHub. This file and the manifest document provenance without adding any app-visible labels.

## Breakfast prompt

Use case: photorealistic-natural. Create ONE standalone landscape 4:3 candid pet activity photo for a pet journal. Reference image is identity reference ONLY: use the same golden retriever, honey-golden coat, cream muzzle and chest, dark round eyes, black nose, broad rounded head and floppy ears. Scene: Sunny eating breakfast kibble from a simple stainless-steel bowl on a cream kitchen floor in a modest contemporary home, soft morning window light, relaxed natural standing posture with head near bowl. Match a young adult golden retriever, keep face recognizable and anatomy natural. Phone snapshot realism, not advertising. Entire dog and bowl in frame, medium distance. No harness indoors. No text, no labels, no watermark, no social media interface, no collage. Do not copy the screenshot layout.

## Shared prompt for rest, walk and play

Use case: photorealistic-natural. ONE standalone landscape 4:3 candid phone photo for a pet journal, not a collage. The attached screenshot is identity reference ONLY. Preserve this same golden retriever's honey-golden fur, cream muzzle and chest, dark round eyes, black nose, broad rounded head, floppy ears and young adult build. No text, labels, watermarks, social interface or screenshot framing. Natural anatomy, realistic home snapshot, medium shot with dog fully recognizable.

Each prompt used the shared text followed by its scene:

### Rest

Scene: Sunny asleep on a soft sage-green rectangular mat beside a living-room window in a modest contemporary home. Side curled resting pose, eyes closed, head resting on front paws, soft afternoon daylight, cream floor, a pale couch softly out of focus. No harness indoors.

### Walk

Scene: Sunny on a morning walk along a quiet leafy neighborhood paved path. Wearing the same light lavender chest harness as the identity reference, ordinary leash extending out of frame to an unseen caregiver. Dog walking at an easy pace and sniffing the edge of grass, soft morning light, no other dogs, no visible person.

### Play

Scene: Sunny playing indoors on a cream living-room floor beside a sage-green dog mat and light couch. Holding a simple rope toy lightly in the mouth, front paws relaxed on the floor, playful attentive face looking toward unseen caregiver, soft late-afternoon window light. No harness indoors. No human visible.

## Association

The four selected illustrations are reused by activity kind across the synthetic week: meal → breakfast.png; rest/settle → rest.png; walk → walk.png; play → play.png. They are activity illustrations, not independent captures for each event or evidence of measured durations. Source details remain in `testData.mediaProvenance` and each record's `mediaProvenance`; no image label is injected into the interface.

Attach explicitly with `scripts/attach-synthetic-media.mjs <username> <image-directory>`, using terminal password input with echo disabled. The script preserves other pets and existing record IDs, text, dates and metrics, verifies private uploads by their hashes, and applies revision checks before saving.
