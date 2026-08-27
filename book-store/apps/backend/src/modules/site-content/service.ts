import { MedusaService } from "@medusajs/framework/utils"
import Article from "./models/article"
import Banner from "./models/banner"
import Brand from "./models/brand"
import Catalog from "./models/catalog"
import ContentPage from "./models/content-page"
import ContentSection from "./models/content-section"
import FaqItem from "./models/faq-item"
import FooterLink from "./models/footer-link"
import FooterSection from "./models/footer-section"
import NavigationItem from "./models/navigation-item"
import NavigationMenu from "./models/navigation-menu"
import SiteSetting from "./models/site-setting"

class SiteContentModuleService extends MedusaService({
  Article,
  Banner,
  Brand,
  Catalog,
  ContentPage,
  ContentSection,
  FaqItem,
  FooterLink,
  FooterSection,
  NavigationItem,
  NavigationMenu,
  SiteSetting,
}) {}

export default SiteContentModuleService
