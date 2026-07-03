const z = require("zod");
const schema = z.object({
    role: z.enum(["STUDENT","OPERATION"]).default("STUDENT"),
    stageId: z.preprocess(
        (v) => (v === "" ? undefined : v),
        z.string().uuid("Stage must be a valid UUID").optional()
    ),
}).refine(
    (data) => {
        if (data.role === "STUDENT" && !data.stageId) return false;
        return true;
    },
    { message: "Please select your stage", path: ["stageId"] }
);
const r = schema.safeParse({ stageId: "", role: "STUDENT" });
console.log("success:", r.success);
if (!r.success) console.log(JSON.stringify(r.error.flatten(), null, 2));
