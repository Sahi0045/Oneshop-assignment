"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DollarSign,
  Clock,
  FileText,
  Paperclip,
  Send,
  AlertCircle,
  X,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCreateBid } from "@/hooks/use-bids";
import { cn, formatCurrency } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const bidFormSchema = z.object({
  amount: z
    .number({
      required_error: "Bid amount is required",
      invalid_type_error: "Please enter a valid amount",
    })
    .positive("Amount must be greater than 0")
    .max(1_000_000, "Amount cannot exceed $1,000,000")
    .multipleOf(0.01, "At most 2 decimal places"),
  deliveryDays: z
    .number({
      required_error: "Delivery days is required",
      invalid_type_error: "Please enter a valid number",
    })
    .int("Must be a whole number")
    .positive("At least 1 day required")
    .max(365, "Cannot exceed 365 days"),
  coverLetter: z
    .string({ required_error: "Cover letter is required" })
    .trim()
    .min(100, "Cover letter must be at least 100 characters")
    .max(3000, "Cover letter must not exceed 3,000 characters"),
});

type BidFormValues = z.infer<typeof bidFormSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BidFormProps {
  /** The ID of the project to bid on. */
  projectId: string;
  /** Project title displayed in the card header. */
  projectTitle?: string;
  /** Minimum budget set by the client (for the insight banner). */
  projectBudgetMin?: number;
  /** Maximum budget set by the client (for the insight banner). */
  projectBudgetMax?: number;
  /** Currency code used for formatting (defaults to 'USD'). */
  currency?: string;
  /** Called with the new bid's ID after a successful submission. */
  onSuccess?: (bidId: string) => void;
  /** Called when the user cancels. */
  onCancel?: () => void;
  /** Compact (inline) mode — removes the Card wrapper. */
  compact?: boolean;
  className?: string;
}

// ─── Cover letter tips ────────────────────────────────────────────────────────

const COVER_LETTER_TIPS = [
  "Explain why you're the best fit for this project",
  "Reference specific requirements from the project description",
  "Highlight relevant experience and past work",
  "Be clear about your timeline and approach",
  "Ask any clarifying questions you may have",
];

// ─── Gavel icon (inline to avoid lucide-react version mismatch) ───────────────

function GavelIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </svg>
  );
}

// ─── Spinner (inline to avoid circular deps) ──────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BidForm({
  projectId,
  projectTitle,
  projectBudgetMin,
  projectBudgetMax,
  currency = "USD",
  onSuccess,
  onCancel,
  compact = false,
  className,
}: BidFormProps) {
  const createBid = useCreateBid();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showTips, setShowTips] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [lastSubmittedAmount, setLastSubmittedAmount] = useState<
    number | undefined
  >(undefined);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<BidFormValues>({
    resolver: zodResolver(bidFormSchema),
    defaultValues: {
      amount: undefined,
      deliveryDays: undefined,
      coverLetter: "",
    },
  });

  const coverLetterValue = watch("coverLetter") ?? "";
  const amountValue = watch("amount");
  const deliveryDaysValue = watch("deliveryDays");

  const charCount = coverLetterValue.length;
  const isLoading = createBid.isPending || isSubmitting;

  // ── Budget insight ────────────────────────────────────────────────────────

  type InsightType = "success" | "warning" | "info";

  const getBudgetInsight = (
    amount: number | undefined,
  ): { type: InsightType; message: string } | null => {
    if (
      !amount ||
      projectBudgetMin === undefined ||
      projectBudgetMax === undefined
    )
      return null;

    if (amount < projectBudgetMin) {
      return {
        type: "warning",
        message: `Your bid is below the client's budget range (${formatCurrency(projectBudgetMin, currency)} – ${formatCurrency(projectBudgetMax, currency)}).`,
      };
    }
    if (amount > projectBudgetMax) {
      return {
        type: "info",
        message: `Your bid is above the client's budget range. Make sure to justify the premium in your cover letter.`,
      };
    }
    return {
      type: "success",
      message: `Your bid is within the client's budget range. Great starting point!`,
    };
  };

  const budgetInsight = getBudgetInsight(amountValue);

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "text/plain",
    ];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const MAX_FILES = 5;

    const valid = files.filter(
      (f) => allowedTypes.includes(f.type) && f.size <= MAX_FILE_SIZE,
    );

    setAttachments((prev) => [...prev, ...valid].slice(0, MAX_FILES));

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: BidFormValues) => {
    try {
      // In a real implementation you'd upload attachments first and receive URLs
      const attachmentUrls: string[] = [];

      const result = await createBid.mutateAsync({
        projectId,
        amount: values.amount,
        currency,
        deliveryDays: values.deliveryDays,
        coverLetter: values.coverLetter,
        attachments: attachmentUrls,
      });

      setLastSubmittedAmount(values.amount);
      setSubmitSuccess(true);
      reset();
      setAttachments([]);
      onSuccess?.(result.data.id);
    } catch {
      // Errors are displayed via createBid.isError / createBid.error below
    }
  };

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitSuccess) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-8 text-center",
          "dark:border-green-800 dark:bg-green-900/20",
          className,
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
          <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-green-900 dark:text-green-100">
            Bid submitted successfully!
          </h3>
          <p className="text-sm text-green-700 dark:text-green-300">
            Your bid of{" "}
            <span className="font-semibold">
              {lastSubmittedAmount
                ? formatCurrency(lastSubmittedAmount, currency)
                : ""}
            </span>{" "}
            has been sent to the client. You&apos;ll be notified when they
            review it.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/30"
          onClick={() => setSubmitSuccess(false)}
        >
          Submit another bid
        </Button>
      </div>
    );
  }

  // ── Form body ─────────────────────────────────────────────────────────────

  const formBody = (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
      aria-label="Place a bid"
    >
      {/* ── Amount + Delivery days ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Bid Amount */}
        <div className="space-y-1.5">
          <Label htmlFor="bid-amount">
            Your Bid{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <div className="relative">
            <DollarSign
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              id="bid-amount"
              type="number"
              step="0.01"
              min="1"
              max="1000000"
              placeholder="0.00"
              inputMode="decimal"
              disabled={isLoading}
              aria-invalid={!!errors.amount}
              aria-describedby={
                errors.amount ? "bid-amount-error" : "bid-amount-hint"
              }
              {...register("amount", { valueAsNumber: true })}
              className={cn(
                "pl-9",
                errors.amount &&
                  "border-destructive focus-visible:ring-destructive",
              )}
            />
          </div>
          <p id="bid-amount-hint" className="text-xs text-muted-foreground">
            {projectBudgetMin !== undefined && projectBudgetMax !== undefined
              ? `Client budget: ${formatCurrency(projectBudgetMin, currency)}${
                  projectBudgetMin !== projectBudgetMax
                    ? ` – ${formatCurrency(projectBudgetMax, currency)}`
                    : ""
                }`
              : "Enter your desired fee"}
          </p>
          {errors.amount && (
            <p
              id="bid-amount-error"
              className="flex items-center gap-1 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {errors.amount.message}
            </p>
          )}
        </div>

        {/* Delivery Days */}
        <div className="space-y-1.5">
          <Label htmlFor="delivery-days">
            Delivery Days{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <div className="relative">
            <Clock
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              id="delivery-days"
              type="number"
              step="1"
              min="1"
              max="365"
              placeholder="e.g. 14"
              inputMode="numeric"
              disabled={isLoading}
              aria-invalid={!!errors.deliveryDays}
              aria-describedby={
                errors.deliveryDays ? "delivery-days-error" : undefined
              }
              {...register("deliveryDays", { valueAsNumber: true })}
              className={cn(
                "pl-9",
                errors.deliveryDays &&
                  "border-destructive focus-visible:ring-destructive",
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            How many days to complete?
          </p>
          {errors.deliveryDays && (
            <p
              id="delivery-days-error"
              className="flex items-center gap-1 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {errors.deliveryDays.message}
            </p>
          )}
        </div>
      </div>

      {/* ── Budget insight banner ───────────────────────────────────────── */}
      {budgetInsight && amountValue && (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
            budgetInsight.type === "success" &&
              "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200",
            budgetInsight.type === "warning" &&
              "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200",
            budgetInsight.type === "info" &&
              "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200",
          )}
          role="status"
          aria-live="polite"
        >
          {budgetInsight.type === "success" ? (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <p>{budgetInsight.message}</p>
        </div>
      )}

      {/* ── Cover Letter ────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="cover-letter">
            Cover Letter{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <button
            type="button"
            onClick={() => setShowTips((p) => !p)}
            className="text-xs text-primary hover:underline underline-offset-4 transition-colors"
            aria-expanded={showTips}
            aria-controls="cover-letter-tips"
          >
            {showTips ? "Hide tips" : "Writing tips"}
          </button>
        </div>

        {/* Tips panel */}
        {showTips && (
          <div
            id="cover-letter-tips"
            className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
            role="note"
            aria-label="Cover letter writing tips"
          >
            <p className="mb-2 text-xs font-semibold text-blue-800 dark:text-blue-200">
              Tips for a winning cover letter:
            </p>
            <ul className="space-y-1">
              {COVER_LETTER_TIPS.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300"
                >
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500"
                    aria-hidden="true"
                  />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Textarea
          id="cover-letter"
          placeholder={`Introduce yourself and explain why you're the best candidate for this project.\n\nMention relevant experience, your approach to the work, and any questions you have about the requirements…`}
          rows={compact ? 6 : 8}
          disabled={isLoading}
          showCount
          maxLength={3000}
          aria-invalid={!!errors.coverLetter}
          aria-describedby={
            errors.coverLetter ? "cover-letter-error" : "cover-letter-min"
          }
          {...register("coverLetter")}
          className={cn(
            errors.coverLetter &&
              "border-destructive focus-visible:ring-destructive",
          )}
        />

        {/* Min-character progress (shown before 100 chars) */}
        {!errors.coverLetter && charCount > 0 && charCount < 100 && (
          <div className="space-y-1" id="cover-letter-min" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Minimum: 100 characters</span>
              <span>{charCount}/100</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(charCount / 100) * 100}%` }}
              />
            </div>
          </div>
        )}

        {charCount >= 100 && !errors.coverLetter && (
          <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Great length! Keep going to make it more compelling.
          </p>
        )}

        {errors.coverLetter && (
          <p
            id="cover-letter-error"
            className="flex items-center gap-1 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {errors.coverLetter.message}
          </p>
        )}
      </div>

      {/* ── File attachments ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Paperclip
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            Attachments
            <span className="text-xs font-normal text-muted-foreground">
              (optional · max 5 files · 10 MB each)
            </span>
          </Label>
          {attachments.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {attachments.length}/5 files
            </span>
          )}
        </div>

        {/* Attached file list */}
        {attachments.length > 0 && (
          <ul className="space-y-1.5" aria-label="Attached files">
            {attachments.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <FileText
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className={cn(
                    "shrink-0 rounded-sm text-muted-foreground",
                    "hover:text-destructive transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Upload zone */}
        {attachments.length < 5 && (
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-background px-4 py-3",
              "text-sm text-muted-foreground",
              "hover:border-primary/40 hover:bg-accent hover:text-foreground",
              "focus-within:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              "transition-all duration-150",
            )}
          >
            <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Click to attach files{" "}
              <span className="text-xs">(PDF, DOC, PNG, JPG, ZIP)</span>
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.zip,.txt"
              onChange={handleFileChange}
              disabled={isLoading}
              className="sr-only"
              aria-label="Attach files to your bid"
            />
          </label>
        )}
      </div>

      {/* ── Bid summary ─────────────────────────────────────────────────── */}
      {amountValue && deliveryDaysValue && (
        <>
          <Separator />
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5">
            <h4 className="text-sm font-semibold text-foreground">
              Bid Summary
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  Your Bid Amount
                </span>
                <span className="font-bold text-foreground text-base tabular-nums">
                  {formatCurrency(amountValue, currency)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  Delivery Timeline
                </span>
                <span className="font-bold text-foreground text-base">
                  {deliveryDaysValue} {deliveryDaysValue === 1 ? "day" : "days"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  Platform Fee (10%)
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  −{formatCurrency(amountValue * 0.1, currency)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  You Receive
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
                  {formatCurrency(amountValue * 0.9, currency)}
                </span>
              </div>
            </div>
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              * Fees are deducted only when your bid is accepted and the work is
              completed.
            </p>
          </div>
        </>
      )}

      {/* ── API error ────────────────────────────────────────────────────── */}
      {createBid.isError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {(createBid.error as Error)?.message ??
              "Failed to submit your bid. Please try again."}
          </p>
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 gap-2"
          size={compact ? "default" : "lg"}
          aria-label={isLoading ? "Submitting bid…" : "Submit bid"}
        >
          {isLoading ? (
            <>
              <Spinner />
              Submitting…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Submit Bid
            </>
          )}
        </Button>

        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={onCancel}
            size={compact ? "default" : "lg"}
          >
            Cancel
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        By submitting, you agree to FreelancerHub&apos;s{" "}
        <a
          href="/terms"
          className="underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Terms of Service
        </a>
        .
      </p>
    </form>
  );

  // ── Compact (inline) mode ─────────────────────────────────────────────────

  if (compact) {
    return <div className={cn("space-y-4", className)}>{formBody}</div>;
  }

  // ── Full card mode ────────────────────────────────────────────────────────

  return (
    <Card className={cn("shadow-soft", className)} id="bid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GavelIcon className="h-5 w-5 text-primary" />
          Place Your Bid
        </CardTitle>
        <CardDescription>
          {projectTitle ? (
            <>
              Submit a competitive proposal for{" "}
              <span className="font-medium text-foreground">
                {projectTitle}
              </span>
              .
            </>
          ) : (
            "Submit a competitive proposal for this project."
          )}{" "}
          Your bid is free to submit and only finalised when awarded.
        </CardDescription>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}
