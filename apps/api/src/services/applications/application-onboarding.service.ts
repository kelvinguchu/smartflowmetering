import { and, desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../db";
import {
  customers,
  meterApplications,
  meters,
  motherMeters,
  properties,
  tariffs,
} from "../../db/schema";
import { normalizeKenyanPhoneNumber } from "../../lib/staff-contact";
import type {
  approveApplicationSchema,
  applicationQuerySchema,
  createApplicationSchema,
} from "../../validators/applications";
import {
  toMeterApplicationAdminDetail,
  toMeterApplicationSupportDetail,
  toMeterApplicationSummary,
  type MeterApplicationAdminDetail,
  type MeterApplicationSupportDetail,
} from "./application-onboarding-response.service";
import {
  ApplicationError,
  buildDefaultPropertyName,
  formatDecimal,
  mapUtilityType,
  normalizeOptionalString,
  normalizeSubMeterNumbers,
} from "./application-onboarding.helpers";
export { ApplicationError } from "./application-onboarding.helpers";

type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
type ApplicationQueryInput = z.infer<typeof applicationQuerySchema>;
type ApproveApplicationInput = z.infer<typeof approveApplicationSchema>;

export async function createMeterApplication(input: CreateApplicationInput) {
  const subMeterNumbers = normalizeSubMeterNumbers(input.subMeterNumbers);
  const phoneNumber = normalizeKenyanPhoneNumber(input.phoneNumber);
  const technicianPhone = normalizeOptionalPhoneNumber(input.technicianPhone);
  const [application] = await db
    .insert(meterApplications)
    .values({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phoneNumber,
      email: input.email.trim().toLowerCase(),
      idNumber: input.idNumber.trim(),
      kraPin: input.kraPin.trim().toUpperCase(),
      county: input.county.trim(),
      location: input.location.trim(),
      buildingType: input.buildingType,
      utilityType: input.utilityType,
      motherMeterNumber: input.motherMeterNumber.trim(),
      initialReading:
        input.initialReading == null
          ? null
          : formatDecimal(input.initialReading, 2),
      paymentMode: input.paymentMode,
      subMeterNumbers,
      installationType: input.installationType,
      suppliesOtherHouses: input.suppliesOtherHouses,
      billPayer: input.billPayer,
      technicianName: normalizeOptionalString(input.technicianName),
      technicianPhone,
      termsAccepted: input.termsAccepted,
      status: "pending",
    })
    .returning();

  return application;
}

export async function listMeterApplicationSummaries(query: ApplicationQueryInput) {
  const where = query.status
    ? eq(meterApplications.status, query.status)
    : undefined;

  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  const result = await db.query.meterApplications.findMany({
    columns: {
      buildingType: true,
      county: true,
      createdAt: true,
      email: true,
      firstName: true,
      id: true,
      lastName: true,
      location: true,
      motherMeterNumber: true,
      paymentMode: true,
      phoneNumber: true,
      status: true,
      subMeterNumbers: true,
      utilityType: true,
    },
    where,
    orderBy: [desc(meterApplications.createdAt)],
    limit,
    offset,
  });

  return {
    count: result.length,
    data: result.map(toMeterApplicationSummary),
    limit,
    offset,
  };
}

export async function getMeterApplicationSupportDetailById(
  id: string,
): Promise<MeterApplicationSupportDetail | null> {
  const application = await db.query.meterApplications.findFirst({
    where: and(
      eq(meterApplications.id, id),
      eq(meterApplications.status, "pending"),
    ),
    columns: {
      billPayer: true,
      buildingType: true,
      county: true,
      createdAt: true,
      email: true,
      firstName: true,
      id: true,
      initialReading: true,
      installationType: true,
      lastName: true,
      location: true,
      motherMeterNumber: true,
      paymentMode: true,
      phoneNumber: true,
      status: true,
      subMeterNumbers: true,
      suppliesOtherHouses: true,
      technicianName: true,
      technicianPhone: true,
      utilityType: true,
    },
  });

  if (!application) {
    return null;
  }

  return toMeterApplicationSupportDetail(application);
}

export async function getMeterApplicationAdminDetailById(
  id: string,
): Promise<MeterApplicationAdminDetail | null> {
  const application = await db.query.meterApplications.findFirst({
    where: eq(meterApplications.id, id),
  });

  if (!application) {
    return null;
  }

  return toMeterApplicationAdminDetail(application);
}

export async function approveMeterApplication(
  applicationId: string,
  options: ApproveApplicationInput
) {
  const application = await getRequiredPendingApplication(applicationId);
  const subMeterNumbers = normalizeSubMeterNumbers(application.subMeterNumbers);
  const meterType = mapUtilityType(application.utilityType);

  const tariff = await db.query.tariffs.findFirst({
    where: eq(tariffs.id, options.tariffId),
    columns: { id: true },
  });
  if (!tariff) {
    throw new ApplicationError(400, "Tariff not found");
  }

  const created = await db.transaction(async (tx) => {
    const existingCustomer = await tx.query.customers.findFirst({
      where: eq(customers.phoneNumber, application.phoneNumber),
      columns: { id: true },
    });

    const customerId =
      existingCustomer?.id ??
      (
        await tx
          .insert(customers)
          .values({
            userId: crypto.randomUUID(),
            name: `${application.firstName} ${application.lastName}`.trim(),
            phoneNumber: application.phoneNumber,
            customerType: "landlord",
          })
          .returning({ id: customers.id })
      )[0].id;

    const existingMotherMeter = await tx.query.motherMeters.findFirst({
      where: eq(motherMeters.motherMeterNumber, application.motherMeterNumber),
      columns: { id: true },
    });
    if (existingMotherMeter) {
      throw new ApplicationError(
        409,
        `Mother meter ${application.motherMeterNumber} already exists`
      );
    }

    const duplicates =
      subMeterNumbers.length === 0
        ? []
        : await tx
            .select({ meterNumber: meters.meterNumber })
            .from(meters)
            .where(inArray(meters.meterNumber, subMeterNumbers));

    if (duplicates.length > 0) {
      throw new ApplicationError(
        409,
        `Sub-meter(s) already exist: ${duplicates
          .map((item) => item.meterNumber)
          .join(", ")}`
      );
    }

    const [property] = await tx
      .insert(properties)
      .values({
        landlordId: customerId,
        name: options.propertyName?.trim() ?? buildDefaultPropertyName(application),
        location: `${application.location}, ${application.county}`,
        numberOfUnits: subMeterNumbers.length,
      })
      .returning({ id: properties.id });

    const [motherMeter] = await tx
      .insert(motherMeters)
      .values({
        motherMeterNumber: application.motherMeterNumber,
        type: options.motherMeterType ?? application.paymentMode,
        landlordId: customerId,
        tariffId: options.tariffId,
        propertyId: property.id,
      lowBalanceThreshold: formatDecimal(options.lowBalanceThreshold ?? 1000, 2),
      })
      .returning({ id: motherMeters.id });

    const meterValues = subMeterNumbers.map((meterNumber) => ({
      meterNumber,
      meterType,
      brand: options.meterBrand ?? "hexing",
      motherMeterId: motherMeter.id,
      tariffId: options.tariffId,
      supplyGroupCode: options.supplyGroupCode ?? "600675",
      keyRevisionNumber: options.keyRevisionNumber ?? 1,
      tariffIndex: options.tariffIndex ?? 1,
      status: "active" as const,
    }));

    await tx.insert(meters).values(meterValues);

    await tx
      .update(meterApplications)
      .set({ status: "approved" })
      .where(
        and(
          eq(meterApplications.id, application.id),
          eq(meterApplications.status, "pending")
        )
      );

    return {
      customerId,
      propertyId: property.id,
      motherMeterId: motherMeter.id,
      createdMeters: meterValues.length,
    };
  });

  return {
    applicationId,
    ...created,
    landlordName: `${application.firstName} ${application.lastName}`.trim(),
    phoneNumber: application.phoneNumber,
    motherMeterNumber: application.motherMeterNumber,
  };
}

function normalizeOptionalPhoneNumber(
  phoneNumber: string | undefined,
): string | null {
  const normalized = normalizeOptionalString(phoneNumber);
  if (normalized === null) {
    return null;
  }

  return normalizeKenyanPhoneNumber(normalized);
}

export async function rejectMeterApplication(applicationId: string) {
  const application = await getRequiredPendingApplication(applicationId);
  await db
    .update(meterApplications)
    .set({ status: "rejected" })
    .where(eq(meterApplications.id, application.id));
}

async function getRequiredPendingApplication(applicationId: string) {
  const application = await db.query.meterApplications.findFirst({
    where: eq(meterApplications.id, applicationId),
  });

  if (!application) {
    throw new ApplicationError(404, "Application not found");
  }

  if (application.status !== "pending") {
    throw new ApplicationError(
      400,
      `Application is already ${application.status}`
    );
  }

  return application;
}



