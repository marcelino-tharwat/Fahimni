import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { okResponse } from "../../shared/utils/apiResponse.js";
import { PaymentService } from "./payment.service.js";
import type { PaymentStatusDTO } from "./payment.types.js";
import type { CheckoutInput } from "./payment.validation.js";
import { getLang, paymentMessages } from "./payment.i18n.js";

const paymentService = new PaymentService();

export class PaymentController {
  public checkout = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user!.id;
      const { chapterId } = req.body as CheckoutInput;
      const lang = getLang(req.headers["accept-language"]);

      const result = await paymentService.checkout(studentId, chapterId, lang);

      res
        .status(201)
        .json(okResponse<{ iframeUrl: string; orderId: string }>(
          paymentMessages.checkoutSuccess[lang],
          result,
        ));
    },
  );

  public webhook = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const hmac = req.query.hmac as string;
      const payload = req.body.obj;

      await paymentService.handleWebhook(payload, hmac);

      res
        .status(200)
        .json(okResponse("Webhook processed"));
    },
  );

  public getPaymentStatus = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const studentId = req.user!.id;
      const { orderId } = req.params as { orderId: string };
      const lang = getLang(req.headers["accept-language"]);

      const status = await paymentService.getPaymentStatus(orderId, studentId, lang);

      res
        .status(200)
        .json(okResponse<PaymentStatusDTO>(
          paymentMessages.paymentStatusRetrieved[lang],
          status,
        ));
    },
  );
}
