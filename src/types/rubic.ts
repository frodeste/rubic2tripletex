/**
 * Rubic API type definitions.
 * Based on the OpenAPI spec at:
 * https://rubicexternalapitest.azurewebsites.net/swagger/v1/swagger.json
 */

export type CustomerType = 1 | 2 | 3;

export interface RubicCustomer {
	customerNo: string | null;
	customerType: CustomerType;
	customerTypeName: string | null;
	customerName: string | null;
	email: string | null;
	countryCode: string | null;
	mobile: string | null;
	address: string | null;
	address2: string | null;
	zipCode: string | null;
	city: string | null;
	countryName: string | null;
	ledgerCustomerNo: string | null;
}

export interface RubicProduct {
	productID: number;
	productCode: string | null;
	productName: string | null;
	productDescription: string | null;
	productGroupID: number;
	departmentID: number | null;
	price: number;
}

export interface RubicProductGroup {
	productGroupID: number;
	productGroupName: string | null;
	taxCodeID: number;
	productGroupTypeID: number | null;
	organizationID: number | null;
	accountNumber: string | null;
	taxCode: RubicProductTaxCode | null;
	productGroupType: RubicProductGroupType | null;
	active: boolean;
}

export interface RubicProductTaxCode {
	taxCodeID: number;
	taxCode1: string | null;
	taxCodeName: string | null;
	taxPercent: number;
}

export interface RubicProductGroupType {
	productGroupTypeID: 1 | 2;
	productGroupTypeName: string | null;
}

export type InvoicePaymentStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface RubicInvoiceLine {
	invoiceLineID: number;
	productID: number;
	productCode: string | null;
	productName: string | null;
	productGroupName: string | null;
	accountNumber: string | null;
	departmentID: number | null;
	departmentNumber: string | null;
	departmentName: string | null;
	price: number;
	specification: string | null;
	quantity: number;
	discountPercentage: number;
	discount: number;
	taxPercentage: number;
	netTotal: number;
	tax: number;
	grossTotal: number;
}

export interface RubicInvoice {
	customer: RubicCustomer;
	invoiceID: number;
	invoiceNumber: number;
	orderID: number;
	invoiceDate: string;
	sentDate: string;
	dueDate: string;
	ledgerYear: number;
	netTotal: number;
	taxTotal: number;
	grossTotal: number;
	balance: number;
	paidAmount: number;
	creditedAmount: number;
	correctedAmount: number;
	creditNoteAmount: number;
	unpaidAmount: number;
	totalAmount: number;
	paymentStatus: InvoicePaymentStatus;
	paymentStatusText: string | null;
	created: string;
	reminderNumber: number | null;
	groupNames: string | null;
	description: string | null;
	externalCustomerIdentity: string | null;
	memberNo: number;
	invoiceLines: RubicInvoiceLine[] | null;
}

export interface RubicInvoiceTransaction {
	invoiceTransactionID: number;
	invoiceID: number;
	invoiceNumber: number;
	paymentDate: string;
	expectedPayoutDate: string | null;
	transactionTypeID: number;
	transactionTypeName: string | null;
	paidAmount: number;
	paymentFee: number;
	vatPaymentFee: number;
	payoutAmount: number;
	customer: RubicCustomer;
}

export interface RubicMember {
	id: number;
	personID: number;
	firstName: string | null;
	lastName: string | null;
	fullName: string | null;
	email: string | null;
	alternateEmail: string | null;
	countryCode: string | null;
	mobile: string | null;
	address: string | null;
	address2: string | null;
	zipCode: string | null;
	city: string | null;
	countryName: string | null;
	memberNo: number;
	ledgerCustomerNo: string | null;
	memberStatus: 0 | 1 | 2;
	created: string;
	modified: string | null;
}

export interface RubicCompanyMember {
	companyID: number;
	companyName: string | null;
	registrationAuthorityOrganizationNumber: string | null;
	email: string | null;
	alternateEmail: string | null;
	countryCode: string | null;
	mobile: string | null;
	address: string | null;
	address2: string | null;
	zipCode: string | null;
	city: string | null;
	countryName: string | null;
	memberNo: number;
	ledgerCustomerNo: string | null;
	memberStatus: 0 | 1 | 2;
	created: string;
	modified: string | null;
}

export interface RubicProductDepartment {
	productDepartmentID: number;
	productDepartmentNumber: string | null;
	productDepartmentName: string | null;
	organizationID: number | null;
}
