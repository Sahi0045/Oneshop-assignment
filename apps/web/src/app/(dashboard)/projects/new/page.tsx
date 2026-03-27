"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Eye,
  CheckCircle2,
  Briefcase,
  DollarSign,
  Calendar,
  Tag,
  Globe,
  Lock,
  Users,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useCreateProject } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StepProgress } from "@/components/ui/progress";
import { cn, formatCurrency } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(10, "At least 10 characters")
    .max(200, "At most 200 characters"),
  description: z
    .string({ required_error: "Description is required" })
    .trim()
    .min(50, "At least 50 characters")
    .max(10000, "At most 10,000 characters"),
  type: z.enum(["FIXED_PRICE", "HOURLY", "CONTEST"], {
    required_error: "Project type is required",
  }),
  category: z.string().optional(),
});

const milestoneSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(200),
  description: z.string().trim().max(500).optional(),
  amount: z.number().positive("Must be positive").max(1_000_000),
  dueDate: z.string().optional(),
  order: z.number().int(),
});

const step2Base = z
  .object({
    budgetMin: z
      .number({ required_error: "Minimum budget is required" })
      .positive("Must be positive")
      .max(10_000_000),
    budgetMax: z
      .number({ required_error: "Maximum budget is required" })
      .positive("Must be positive")
      .max(10_000_000),
    currency: z.string().length(3).default("USD"),
    deadline: z.string().optional(),
    milestones: z.array(milestoneSchema).max(20),
  });

const step2Schema = step2Base.refine((d) => d.budgetMax >= d.budgetMin, {
    message: "Maximum budget must be ≥ minimum budget",
    path: ["budgetMax"],
  });

const SKILL_INPUT_SCHEMA = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9\s.#+\-/]+$/, "Invalid characters");

const step3Schema = z.object({
  skills: z.array(z.string()).min(1, "Add at least one skill").max(20),
  visibility: z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY"]).default("PUBLIC"),
});

const fullSchema = step1Schema.merge(step2Base).merge(step3Schema).refine((d) => d.budgetMax >= d.budgetMin, {
  message: "Maximum budget must be ≥ minimum budget",
  path: ["budgetMax"],
});
type ProjectFormValues = z.infer<typeof fullSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["Basic Info", "Budget & Timeline", "Skills & Details"];

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD"];

const CATEGORIES = [
  "Web Development",
  "Mobile Development",
  "Design & Creative",
  "Data & Analytics",
  "Writing & Content",
  "Digital Marketing",
  "AI & Machine Learning",
  "Video & Photo",
  "Software Engineering",
  "DevOps & Cloud",
  "Cybersecurity",
  "Other",
];

const POPULAR_SKILLS = [
  "React",
  "Node.js",
  "Python",
  "TypeScript",
  "Next.js",
  "UI/UX Design",
  "AWS",
  "PostgreSQL",
  "GraphQL",
  "Flutter",
  "Vue.js",
  "Docker",
  "Figma",
  "SEO",
  "Content Writing",
];

const PROJECT_TYPES = [
  {
    value: "FIXED_PRICE",
    label: "Fixed Price",
    description: "Pay a set amount for the entire project.",
    icon: DollarSign,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    value: "HOURLY",
    label: "Hourly",
    description: "Pay by the hour — ideal for ongoing work.",
    icon: Calendar,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    border: "border-violet-200 dark:border-violet-800",
  },
  {
    value: "CONTEST",
    label: "Contest",
    description: "Receive multiple submissions and pick the winner.",
    icon: Users,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
  },
] as const;

const VISIBILITY_OPTIONS = [
  {
    value: "PUBLIC",
    label: "Public",
    description: "Visible to all freelancers",
    icon: Globe,
  },
  {
    value: "PRIVATE",
    label: "Private",
    description: "Only visible via direct link",
    icon: Lock,
  },
  {
    value: "INVITE_ONLY",
    label: "Invite Only",
    description: "Only invited freelancers can bid",
    icon: Users,
  },
] as const;

// ─── Field error helper ───────────────────────────────────────────────────────

function FieldError({ message }: { message?: any }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

// ─── Step 1: Basic Info ───────────────────────────────────────────────────────

interface Step1Props {
  register: ReturnType<typeof useForm<ProjectFormValues>>["register"];
  watch: ReturnType<typeof useForm<ProjectFormValues>>["watch"];
  setValue: ReturnType<typeof useForm<ProjectFormValues>>["setValue"];
  errors: ReturnType<typeof useForm<ProjectFormValues>>["formState"]["errors"];
}

function Step1({ register, watch, setValue, errors }: Step1Props) {
  const selectedType = watch("type");
  const descriptionValue = watch("description") ?? "";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">
          Project Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          placeholder="e.g. Build a React e-commerce dashboard with real-time analytics"
          {...register("title")}
          className={cn(errors.title && "border-destructive")}
          aria-invalid={!!errors.title}
        />
        <p className="text-xs text-muted-foreground">
          Make it specific and descriptive to attract the right freelancers.
        </p>
        <FieldError message={errors.title?.message} />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder={`Describe your project in detail:\n\n• What are the goals?\n• What technologies/tools should be used?\n• What deliverables do you expect?\n• Are there any specific requirements or constraints?`}
          rows={8}
          showCount
          maxLength={10000}
          {...register("description")}
          className={cn(errors.description && "border-destructive")}
          aria-invalid={!!errors.description}
        />
        {descriptionValue.length < 50 && descriptionValue.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {50 - descriptionValue.length} more characters needed
          </p>
        )}
        <FieldError message={errors.description?.message} />
      </div>

      {/* Project Type */}
      <div className="space-y-2">
        <Label>
          Project Type <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PROJECT_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.value;
            return (
              <label
                key={type.value}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition-all duration-150",
                  isSelected
                    ? cn("border-primary bg-primary/5", type.border, type.bg)
                    : "border-border hover:border-muted-foreground/30 hover:bg-accent/30"
                )}
              >
                <input
                  type="radio"
                  value={type.value}
                  className="sr-only"
                  checked={isSelected}
                  onChange={() =>
                    setValue("type", type.value, { shouldValidate: true })
                  }
                />
                {isSelected && (
                  <CheckCircle2
                    className={cn("absolute right-3 top-3 h-4 w-4", type.color)}
                    aria-hidden="true"
                  />
                )}
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    type.bg
                  )}
                >
                  <Icon className={cn("h-5 w-5", type.color)} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {type.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {type.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        <FieldError message={errors.type?.message} />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <Select
          onValueChange={(v) => setValue("category", v, { shouldValidate: true })}
          defaultValue=""
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Select a category (optional)" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Step 2: Budget & Timeline ────────────────────────────────────────────────

interface Step2Props {
  register: ReturnType<typeof useForm<ProjectFormValues>>["register"];
  watch: ReturnType<typeof useForm<ProjectFormValues>>["watch"];
  setValue: ReturnType<typeof useForm<ProjectFormValues>>["setValue"];
  errors: ReturnType<typeof useForm<ProjectFormValues>>["formState"]["errors"];
  control: ReturnType<typeof useForm<ProjectFormValues>>["control"];
}

function Step2({ register, watch, setValue, errors, control }: Step2Props) {
  const currency = watch("currency") ?? "USD";
  const budgetMin = watch("budgetMin");
  const budgetMax = watch("budgetMax");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "milestones",
  });

  const addMilestone = () => {
    append({
      title: "",
      description: "",
      amount: 0,
      dueDate: "",
      order: fields.length + 1,
    });
  };

  return (
    <div className="space-y-6">
      {/* Budget row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="budgetMin">
            Min Budget <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="budgetMin"
              type="number"
              min="1"
              step="1"
              placeholder="500"
              className={cn("pl-9", errors.budgetMin && "border-destructive")}
              {...register("budgetMin", { valueAsNumber: true })}
            />
          </div>
          <FieldError message={errors.budgetMin?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="budgetMax">
            Max Budget <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="budgetMax"
              type="number"
              min="1"
              step="1"
              placeholder="2000"
              className={cn("pl-9", errors.budgetMax && "border-destructive")}
              {...register("budgetMax", { valueAsNumber: true })}
            />
          </div>
          <FieldError message={errors.budgetMax?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Select
            defaultValue="USD"
            onValueChange={(v) => setValue("currency", v)}
          >
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Budget preview */}
      {budgetMin && budgetMax && budgetMax >= budgetMin && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
          <CheckCircle2 className="inline h-4 w-4 mr-1.5 text-green-500" aria-hidden="true" />
          Budget range:{" "}
          <strong>
            {formatCurrency(budgetMin, currency)} –{" "}
            {formatCurrency(budgetMax, currency)}
          </strong>
        </div>
      )}

      {/* Deadline */}
      <div className="space-y-1.5">
        <Label htmlFor="deadline">Project Deadline</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="deadline"
            type="date"
            className="pl-9"
            min={new Date().toISOString().split("T")[0]}
            {...register("deadline")}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          When do you need this project completed?
        </p>
      </div>

      <Separator />

      {/* Milestones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Milestones
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Break the project into stages with individual payment amounts.
            </p>
          </div>
          {fields.length < 20 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMilestone}
              className="gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Milestone
            </Button>
          )}
        </div>

        {fields.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Tag className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                No milestones added. Optionally break your project into stages.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMilestone}
                className="gap-1.5 mt-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Milestone
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      Milestone {index + 1}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(index)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label={`Remove milestone ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`milestone-title-${index}`} className="text-xs">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`milestone-title-${index}`}
                      placeholder="e.g. Design mockups and prototype"
                      {...register(`milestones.${index}.title`)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`milestone-amount-${index}`} className="text-xs">
                      Amount ({currency}) <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        id={`milestone-amount-${index}`}
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="500"
                        className="pl-8 h-9 text-sm"
                        {...register(`milestones.${index}.amount`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`milestone-due-${index}`} className="text-xs">
                      Due Date
                    </Label>
                    <Input
                      id={`milestone-due-${index}`}
                      type="date"
                      className="h-9 text-sm"
                      min={new Date().toISOString().split("T")[0]}
                      {...register(`milestones.${index}.dueDate`)}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`milestone-desc-${index}`} className="text-xs">
                      Description
                    </Label>
                    <Textarea
                      id={`milestone-desc-${index}`}
                      placeholder="What should be delivered in this milestone?"
                      rows={2}
                      className="text-sm resize-none"
                      {...register(`milestones.${index}.description`)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Skills & Details ─────────────────────────────────────────────────

interface Step3Props {
  watch: ReturnType<typeof useForm<ProjectFormValues>>["watch"];
  setValue: ReturnType<typeof useForm<ProjectFormValues>>["setValue"];
  errors: ReturnType<typeof useForm<ProjectFormValues>>["formState"]["errors"];
}

function Step3({ watch, setValue, errors }: any) {
  const [skillInput, setSkillInput] = useState("");
  const [skillInputError, setSkillInputError] = useState("");
  const selectedSkills = (watch("skills") as string[]) ?? [];
  const selectedVisibility = watch("visibility") ?? "PUBLIC";

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    const result = SKILL_INPUT_SCHEMA.safeParse(trimmed);
    if (!result.success) {
      setSkillInputError(result.error.issues[0]?.message ?? "Invalid skill");
      return;
    }
    if (selectedSkills.includes(trimmed)) {
      setSkillInputError("Skill already added");
      return;
    }
    if (selectedSkills.length >= 20) {
      setSkillInputError("Maximum 20 skills");
      return;
    }
    setValue("skills", [...selectedSkills, trimmed], { shouldValidate: true });
    setSkillInput("");
    setSkillInputError("");
  };

  const removeSkill = (skill: string) => {
    setValue(
      "skills",
      selectedSkills.filter((s) => s !== skill),
      { shouldValidate: true }
    );
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillInput);
    }
  };

  return (
    <div className="space-y-6">
      {/* Skills */}
      <div className="space-y-3">
        <div>
          <Label>
            Required Skills <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add skills that candidates must have. Press Enter or comma to add.
          </p>
        </div>

        {/* Skill input */}
        <div className="flex gap-2">
          <Input
            placeholder="e.g. React, Node.js, Python…"
            value={skillInput}
            onChange={(e) => {
              setSkillInput(e.target.value);
              setSkillInputError("");
            }}
            onKeyDown={handleSkillKeyDown}
            className={cn(skillInputError && "border-destructive")}
            aria-label="Add a skill"
          />
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => addSkill(skillInput)}
            disabled={!skillInput.trim()}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        {skillInputError && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {skillInputError}
          </p>
        )}

        {/* Selected skills */}
        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Selected skills">
            {selectedSkills.map((skill) => (
              <Badge
                key={skill}
                variant="skill"
                className="gap-1.5 pr-1.5"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="rounded-full hover:bg-primary/20 transition-colors p-0.5"
                  aria-label={`Remove ${skill}`}
                >
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    className="h-2.5 w-2.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 2l8 8M10 2l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Popular skills quick-add */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Popular skills:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_SKILLS.filter(
              (s) => !selectedSkills.includes(s)
            ).map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => addSkill(skill)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
              >
                <Plus className="h-3 w-3" />
                {skill}
              </button>
            ))}
          </div>
        </div>

        <FieldError message={errors.skills?.message} />
      </div>

      <Separator />

      {/* Visibility */}
      <div className="space-y-3">
        <div>
          <Label>Project Visibility</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Control who can see and bid on your project.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {VISIBILITY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedVisibility === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-all duration-150",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30 hover:bg-accent/30"
                )}
              >
                <input
                  type="radio"
                  value={option.value}
                  className="sr-only"
                  checked={isSelected}
                  onChange={() =>
                    setValue("visibility", option.value, {
                      shouldValidate: true,
                    })
                  }
                />
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    isSelected
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function Preview({ data }: { data: any }) {
  const typeLabel =
    data.type === "FIXED_PRICE"
      ? "Fixed Price"
      : data.type === "HOURLY"
        ? "Hourly"
        : "Contest";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-primary">
          Preview — This is how your project will appear to freelancers.
        </p>
      </div>

      <div className="space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {data.type && (
              <Badge variant={data.type === "FIXED_PRICE" ? "fixed" : data.type === "HOURLY" ? "hourly" : "contest"}>
                {typeLabel}
              </Badge>
            )}
            {data.visibility && (
              <Badge variant="outline">{data.visibility}</Badge>
            )}
          </div>
          {data.title && (
            <h2 className="text-xl font-bold text-foreground">{data.title}</h2>
          )}
        </div>

        {/* Description */}
        {data.description && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">
              Description
            </p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {data.description}
            </p>
          </div>
        )}

        {/* Budget */}
        {data.budgetMin && data.budgetMax && (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-foreground">
              {formatCurrency(data.budgetMin, data.currency ?? "USD")} –{" "}
              {formatCurrency(data.budgetMax, data.currency ?? "USD")}
            </span>
            {data.type === "HOURLY" && (
              <span className="text-xs text-muted-foreground">/hr</span>
            )}
          </div>
        )}

        {/* Deadline */}
        {data.deadline && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Deadline:</span>
            <span className="font-medium text-foreground">
              {new Date(data.deadline).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        )}

        {/* Skills */}
        {data.skills && data.skills.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">
              Required Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s: any) => (
                <Badge key={s} variant="skill">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Milestones */}
        {data.milestones && data.milestones.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">
              Milestones ({data.milestones.length})
            </p>
            <div className="space-y-2">
              {data.milestones.map((m: any, i: any) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <span className="flex-1 text-sm text-foreground truncate">
                    {m.title || `Milestone ${i + 1}`}
                  </span>
                  {m.amount > 0 && (
                    <span className="text-sm font-semibold text-foreground shrink-0">
                      {formatCurrency(m.amount, data.currency ?? "USD")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const createProject = useCreateProject();

  const [step, setStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      type: "FIXED_PRICE",
      currency: "USD",
      visibility: "PUBLIC",
      skills: [],
      milestones: [],
    },
    mode: "onTouched",
  });

  // Redirect non-clients
  if (user && user.role !== "CLIENT") {
    router.replace("/dashboard/projects");
    return null;
  }

  // ── Step validation ──────────────────────────────────────────────────────

  const STEP_FIELDS: Array<Array<keyof ProjectFormValues>> = [
    ["title", "description", "type"],
    ["budgetMin", "budgetMax", "currency"],
    ["skills", "visibility"],
  ];

  const handleNext = async () => {
    const fields = STEP_FIELDS[step];
    const isValid = await trigger(fields as any);
    if (isValid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (data: ProjectFormValues) => {
    try {
      await createProject.mutateAsync({
        title: data.title,
        description: data.description,
        type: data.type as any,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        currency: data.currency,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        skills: data.skills as any,
        visibility: data.visibility as any,
        milestones: data.milestones?.map((m, i) => ({
          title: m.title,
          description: m.description ?? "",
          amount: m.amount,
          dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
          order: i + 1,
        })) as any,
      });
      router.push("/dashboard/projects");
    } catch {
      // Error shown via createProject.isError
    }
  };

  const formData = getValues();
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Post a New Project
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Describe your project to attract the best freelancers.
          </p>
        </div>
      </div>

      {/* ── Step indicator ─────────────────────────────────────────────────── */}
      <StepProgress
        steps={STEPS.length}
        currentStep={step + 1}
        labels={STEPS}
      />

      {/* ── Preview toggle ──────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowPreview((p) => !p)}
          className="gap-1.5"
        >
          <Eye className="h-4 w-4" />
          {showPreview ? "Hide Preview" : "Preview"}
        </Button>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className={cn("space-y-6", showPreview ? "lg:col-span-3" : "lg:col-span-5")}>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {step + 1}
                </div>
                <div>
                  <CardTitle className="text-lg">{STEPS[step]}</CardTitle>
                  <CardDescription>
                    {step === 0 && "Tell us what you need built."}
                    {step === 1 && "Set your budget and timeline."}
                    {step === 2 && "Specify required skills and visibility."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                {step === 0 && (
                  <Step1
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                  />
                )}
                {step === 1 && (
                  <Step2
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                    control={control}
                  />
                )}
                {step === 2 && (
                  <Step3
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                  />
                )}

                {/* API error */}
                {createProject.isError && (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      {(createProject.error as Error)?.message ??
                        "Failed to create project. Please try again."}
                    </p>
                  </div>
                )}

                {/* Navigation buttons */}
                <div className="mt-8 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={step === 0 || createProject.isPending}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  {isLastStep ? (
                    <Button
                      type="submit"
                      disabled={createProject.isPending}
                      className="gap-2 min-w-32"
                    >
                      {createProject.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Publishing…
                        </>
                      ) : (
                        <>
                          <Briefcase className="h-4 w-4" />
                          Post Project
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="gap-1.5"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Step info card */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Briefcase className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {step === 0 && (
                    <>
                      <p className="font-medium text-foreground">
                        💡 Tips for a great title
                      </p>
                      <p>
                        Be specific about what you need. Good titles mention
                        the technology, deliverable, and scope. Example:{" "}
                        <em>
                          "Build React Admin Dashboard with Charts & Auth"
                        </em>
                        .
                      </p>
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <p className="font-medium text-foreground">
                        💰 Setting the right budget
                      </p>
                      <p>
                        Research market rates for your project type. Providing
                        a wider range attracts more bids. Milestones help
                        manage cash flow and reduce risk.
                      </p>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <p className="font-medium text-foreground">
                        🎯 Choosing the right skills
                      </p>
                      <p>
                        Add all relevant skills — they are used to match your
                        project with qualified freelancers. Include both
                        technical and soft skills where relevant.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview panel */}
        {showPreview && (
          <div className="lg:col-span-2">
            <Card className="sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Preview data={formData} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
