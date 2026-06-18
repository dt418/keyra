import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { requireOrgMember } from "../../middleware/org";
import { listProductsHandler } from "./list";
import { createProductHandler } from "./create";
import { getProductHandler } from "./get";
import { updateProductHandler } from "./update";
import { deleteProductHandler } from "./delete";
import { getApiKeyHandler, regenerateApiKeyHandler } from "./api-key";

export const productsRouter = new Hono();

productsRouter.use("/*", authMiddleware);
productsRouter.use("/*", requireOrgMember);

productsRouter.get("/", listProductsHandler);
productsRouter.post("/", createProductHandler);
productsRouter.get("/:id", getProductHandler);
productsRouter.patch("/:id", updateProductHandler);
productsRouter.delete("/:id", deleteProductHandler);
productsRouter.get("/:id/api-key", getApiKeyHandler);
productsRouter.post("/:id/regenerate-key", regenerateApiKeyHandler);
