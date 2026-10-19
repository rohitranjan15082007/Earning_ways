import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  Shield,
  Users,
} from "lucide-react";
import { ZodError } from "zod";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SkeletonBlock } from "@/components/ui/data-states";
import { useCreateEnquiry } from "@/api/hooks/enquiry";
import { useSetting } from "@/api/hooks/useSetting";
import { createEnquirySchema } from "@/validator/enquiry";
import { cn } from "@/lib/utils";

/** Message cap for the form — the existing 250 character limit, unchanged. */
const MESSAGE_LIMIT = 250;

const SUPPORT_TOPICS = [
  {
    icon: MessageSquare,
    title: "General inquiries",
    description: "Any question about the platform, plans or ROI — start here.",
  },
  {
    icon: Shield,
    title: "Technical support",
    description: "Write to us if you have trouble with login, OTP, Telegram Stars payment or withdrawals.",
  },
  {
    icon: Users,
    title: "Partnership",
    description: "For business collaboration and partnership proposals, put 'Partnership' in the subject.",
  },
];

const FAQ = [
  {
    q: "How long does a reply take?",
    a: "We always aim to answer within 24 working hours. Messages sent during business hours (Mon–Sat, 10:00 AM – 6:00 PM IST) are seen first.",
  },
  {
    q: "Do you provide investment advice?",
    a: "No. The team only provides information about the platform, plans and payouts. We do not give personalised financial or investment advice.",
  },
];

interface FormState {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const EMPTY_FORM: FormState = { name: "", email: "", phone: "", subject: "", message: "" };

export default function Contact() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const mutation = useCreateEnquiry();
  const { data: setting, isLoading: settingLoading, isError: settingError, refetch: refetchSetting, isFetching: settingFetching } = useSetting();

  const supportEmail = setting?.email || "support@expotradex.com";
  const supportPhone = setting?.phoneNumber || "";
  const supportLocation = setting?.location || "";
  const settingUnavailable = settingError && !setting;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === "message") {
      if (value.length > MESSAGE_LIMIT) return; // do not allow typing past the cap
      setCharCount(value.length);
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
    // clear the previous error for the field being corrected
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (mutation.isPending) return; // block double submit
    setFieldErrors({});

    try {
      const validatedData = createEnquirySchema.parse(formData);

      mutation.mutate(validatedData, {
        onSuccess: () => {
          setFormData(EMPTY_FORM);
          setCharCount(0);
          setShowSuccess(true);
        },
        onError: (error: Error) => {
          // keep the values so the user does not have to retype
          setFieldErrors({ submit: error.message || "Could not send the message. Please try again." });
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as string;
          errors[path] = err.message;
        });
        setFieldErrors(errors);
      }
    }
  };

  const goHome = () => {
    setShowSuccess(false);
    navigate("/");
  };

  return (
    <>
      <Navbar />

      <section className="mt-16 py-10 sm:py-14">
        <PageContainer>
          <PageHeader
            title="Contact Us"
            subtitle={
              <>
                Questions, support or partnership — talk to the team directly.{" "}
                <a href={`mailto:${supportEmail}`} className="font-semibold text-info hover:underline">
                  {supportEmail}
                </a>
              </>
            }
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* ---------------- LEFT: contact cards ---------------- */}
            <div className="space-y-4 lg:col-span-5">
              {settingLoading && !setting ? (
                <>
                  <SkeletonBlock className="h-[104px] rounded-xl" />
                  <SkeletonBlock className="h-[104px] rounded-xl" />
                  <SkeletonBlock className="h-[104px] rounded-xl" />
                </>
              ) : (
                <>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="block rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/60"
                  >
                    <span className="grid size-11 place-items-center rounded-lg bg-muted text-ok">
                      <Mail className="size-5" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
                    <p className="mt-1 break-words text-sm font-semibold text-foreground">{supportEmail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Replies within 24–48 hours</p>
                  </a>

                  <a
                    href={supportPhone ? `tel:${supportPhone}` : `mailto:${supportEmail}`}
                    className="block rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/60"
                  >
                    <span className="grid size-11 place-items-center rounded-lg bg-muted text-ok">
                      <Phone className="size-5" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{supportPhone || "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Business hours only</p>
                  </a>

                  <div className="rounded-xl border border-border bg-card p-5 shadow-card">
                    <span className="grid size-11 place-items-center rounded-lg bg-muted text-ok">
                      <Clock className="size-5" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business hours</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Monday to Saturday</p>
                    <p className="text-sm text-muted-foreground">10:00 AM – 6:00 PM (IST)</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Support is closed on Sundays and public holidays.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-5 shadow-card">
                    <span className="grid size-11 place-items-center rounded-lg bg-muted text-ok">
                      <MapPin className="size-5" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Office</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{supportLocation || "Address is updated in the platform settings"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">The postal address is the official communication address</p>
                  </div>
                </>
              )}

              {settingUnavailable ? (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-warn/35 bg-warn/12 p-4">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Unable to load contact details</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The cards above show a fallback email. You can send mail to it, or retry.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchSetting()} disabled={settingFetching}>
                      {settingFetching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
                      {settingFetching ? "Retrying…" : "Retry"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* ---------------- RIGHT: form ---------------- */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
                <h2 className="text-lg font-semibold text-foreground">Send us a message</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fill in the form below — the reply comes to your email.
                </p>

                {/* form values are kept when submit fails */}
                {fieldErrors.submit ? (
                  <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-danger/35 bg-danger/[0.07] p-3.5">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Message could not be sent</p>
                      <p className="mt-1 text-xs text-muted-foreground">{fieldErrors.submit}</p>
                    </div>
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Full name" htmlFor="contact-name" error={fieldErrors.name}>
                      <Input
                        id="contact-name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        autoComplete="name"
                        className={cn("h-11", fieldErrors.name && "border-danger focus-visible:ring-danger")}
                        aria-invalid={!!fieldErrors.name}
                        aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
                      />
                    </Field>

                    <Field label="Email address" htmlFor="contact-email" error={fieldErrors.email} errorId="contact-email-error">
                      <Input
                        id="contact-email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        autoComplete="email"
                        inputMode="email"
                        className={cn("h-11", fieldErrors.email && "border-danger focus-visible:ring-danger")}
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
                      />
                    </Field>

                    <Field label="Phone number" htmlFor="contact-phone" error={fieldErrors.phone} errorId="contact-phone-error">
                      <Input
                        id="contact-phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="9999999999"
                        autoComplete="tel"
                        inputMode="tel"
                        className={cn("h-11", fieldErrors.phone && "border-danger focus-visible:ring-danger")}
                        aria-invalid={!!fieldErrors.phone}
                        aria-describedby={fieldErrors.phone ? "contact-phone-error" : undefined}
                      />
                    </Field>

                    <Field label="Subject" htmlFor="contact-subject" error={fieldErrors.subject} errorId="contact-subject-error">
                      <Input
                        id="contact-subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        placeholder="What is this about?"
                        className={cn("h-11", fieldErrors.subject && "border-danger focus-visible:ring-danger")}
                        aria-invalid={!!fieldErrors.subject}
                        aria-describedby={fieldErrors.subject ? "contact-subject-error" : undefined}
                      />
                    </Field>
                  </div>

                  <Field label="Message" htmlFor="contact-message" error={fieldErrors.message} errorId="contact-message-error">
                    <Textarea
                      id="contact-message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Write your question or issue here…"
                      rows={6}
                      className={cn("min-h-[140px] resize-none", fieldErrors.message && "border-danger focus-visible:ring-danger")}
                      aria-invalid={!!fieldErrors.message}
                      aria-describedby={fieldErrors.message ? "contact-message-error" : "contact-message-count"}
                    />
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Enter at least 10 characters</span>
                      <span
                        id="contact-message-count"
                        className={cn("text-xs font-medium tabular-nums", charCount >= MESSAGE_LIMIT ? "text-warn" : "text-muted-foreground")}
                      >
                        {charCount}/{MESSAGE_LIMIT} characters
                      </span>
                    </div>
                  </Field>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send className="size-4" aria-hidden="true" />
                          Send message
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Your enquiry reaches the team as soon as you send it.
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* ---------------- Support topics ---------------- */}
          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 className="text-lg font-semibold text-foreground">Support topics</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Which question goes where — check here first for a faster reply.
              </p>
              <Accordion type="single" collapsible className="mt-4">
                {SUPPORT_TOPICS.map((topic) => (
                  <AccordionItem key={topic.title} value={topic.title} className="border-border">
                    <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                      <span className="flex items-center gap-2.5">
                        <topic.icon className="size-4 text-ok" aria-hidden="true" />
                        {topic.title}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{topic.description}</AccordionContent>
                  </AccordionItem>
                ))}
                {FAQ.map((item) => (
                  <AccordionItem key={item.q} value={item.q} className="border-border">
                    <AccordionTrigger className="text-sm font-semibold hover:no-underline">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* ---------------- Transparency callout ---------------- */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-border bg-muted p-5">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Transparency &amp; responsibility</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Earning Ways does not provide investment advice. The team only gives information and
                      support related to the platform, plans and payouts — no personalised recommendations.
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
                        Clear communication — every answer in writing and on record
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
                        Ethical practices — no hidden charges or promises
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
                        User responsibility — the final decision is yours
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------- CTA band ---------------- */}
          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-muted p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Have more questions?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The full flow for plans, ROI and payouts is explained step by step on the About page and in the plans section.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/about">
                  Learn about us <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href={`mailto:${supportEmail}`}>Email support</a>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <Footer />

      {/* ---------------- Success dialog ---------------- */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full border border-ok/30 bg-ok/12 text-ok">
              <CheckCircle2 className="size-7" aria-hidden="true" />
            </span>
            <DialogTitle className="mt-2">Message sent</DialogTitle>
            <DialogDescription className="text-center">
              Your enquiry has reached the team. The reply will come to {supportEmail} — usually within 24–48 hours.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full" onClick={goHome}>
              Back to home
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setShowSuccess(false)}>
              Send another message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Field wrapper: connects the label and error to the input accessibly. */
function Field({
  label,
  htmlFor,
  error,
  errorId,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  errorId?: string;
  children: React.ReactNode;
}) {
  const id = errorId ?? `${htmlFor}-error`;
  return (
    <div>
      <Label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
