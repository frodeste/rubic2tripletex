import type { RubicInvoice } from "@/types/rubic";
import type { TripletexOrder, TripletexOrderLine } from "@/types/tripletex";

/**
 * Maps a Rubic Invoice to a Tripletex Order.
 * Invoices in Tripletex are created from orders, so we first create an order.
 *
 * @param invoice - The Rubic invoice to map
 * @param tripletexCustomerId - The Tripletex customer ID (from customer_mapping)
 * @param productMappings - Map of Rubic product codes to Tripletex product IDs
 * @returns A Tripletex Order ready to be created
 */
export function mapRubicInvoiceToTripletexOrder(
	invoice: RubicInvoice,
	tripletexCustomerId: number,
	productMappings: Map<string, number>,
): TripletexOrder {
	const orderLines: TripletexOrderLine[] = [];

	// Map invoice lines to order lines
	if (invoice.invoiceLines && invoice.invoiceLines.length > 0) {
		for (const line of invoice.invoiceLines) {
			// Look up Tripletex product ID from product mappings
			const productCode = line.productCode;
			if (!productCode) {
				// Skip lines without product code
				continue;
			}

			const tripletexProductId = productMappings.get(productCode);
			if (!tripletexProductId) {
				// Skip lines where product mapping is not found
				// This will be logged in the sync function
				continue;
			}

			// Build description from productName and specification
			const descriptionParts: string[] = [];
			if (line.productName) {
				descriptionParts.push(line.productName);
			}
			if (line.specification) {
				descriptionParts.push(line.specification);
			}
			const description = descriptionParts.length > 0 ? descriptionParts.join(" - ") : undefined;

			const orderLine: TripletexOrderLine = {
				product: { id: tripletexProductId },
				count: line.quantity,
				unitPriceExcludingVatCurrency: line.price,
				description,
			};

			// Add discount if present
			if (line.discount > 0) {
				orderLine.discount = line.discount;
			}

			orderLines.push(orderLine);
		}
	}

	// Create the order
	const order: TripletexOrder = {
		customer: { id: tripletexCustomerId },
		deliveryDate: invoice.invoiceDate,
		orderDate: invoice.invoiceDate,
		orderLines: orderLines.length > 0 ? orderLines : undefined,
	};

	return order;
}
