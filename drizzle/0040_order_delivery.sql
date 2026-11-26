ALTER TABLE "comercial"."orders" ADD COLUMN "delivered_at" date;--> statement-breakpoint
ALTER TABLE "comercial"."orders" ADD COLUMN "delivered_by" text;--> statement-breakpoint
ALTER TABLE "comercial"."orders" ADD CONSTRAINT "orders_delivered_by_user_id_fk" FOREIGN KEY ("delivered_by") REFERENCES "transportes"."user"("id") ON DELETE set null ON UPDATE no action;