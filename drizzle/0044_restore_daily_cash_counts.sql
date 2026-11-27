CREATE TABLE "transportes"."daily_cash_counts" (
	"box_id" integer NOT NULL,
	"denomination" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "daily_cash_counts_box_id_denomination_pk" PRIMARY KEY("box_id","denomination"),
	CONSTRAINT "daily_cash_counts_quantity_positive" CHECK ("transportes"."daily_cash_counts"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "transportes"."daily_cash_counts" ADD CONSTRAINT "daily_cash_counts_box_id_daily_cash_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "transportes"."daily_cash_boxes"("id") ON DELETE cascade ON UPDATE no action;