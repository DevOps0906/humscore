import { Toaster } from "@/components/ui/sonner";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="safe-top mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:px-8">{children}</main>
      <Toaster position="top-center" />
    </>
  );
}
