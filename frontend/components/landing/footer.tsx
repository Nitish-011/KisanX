import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#1d2c21] bg-[#020403] text-[#8b968d]">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-8 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div>
          <Link
            href="/"
            className="text-xl font-semibold tracking-[-0.045em] text-[#f0f2ed]"
          >
            Kisan<span className="text-[#e87524]">X</span>
          </Link>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#68756b]">
            AI-powered crop health, harvest and market intelligence.
          </p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <Link href="/auth" className="hover:text-white">
            Get Started
          </Link>
          <Link href="/marketplace" className="hover:text-white">
            Marketplace
          </Link>
          <Link href="/dashboard" className="hover:text-white">
            Dashboard
          </Link>
        </div>
      </div>
      <div className="border-t border-[#162319] px-6 py-5 text-center text-xs text-[#4f5d53]">
        © {new Date().getFullYear()} KisanX · Built for smarter agriculture.
      </div>
    </footer>
  );
}

export default Footer;
