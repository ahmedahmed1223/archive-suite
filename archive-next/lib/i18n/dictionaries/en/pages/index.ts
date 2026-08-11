import { activity } from "./activity";
import { catalog } from "./catalog";
import { commandPalette } from "./commandPalette";
import { dataCenter } from "./dataCenter";
import { discover } from "./discover";
import { duplicates } from "./duplicates";
import { favorites } from "./favorites";
import { firstRun } from "./firstRun";
import { geotagPanel } from "./geotagPanel";
import { loading } from "./loading";
import { login } from "./login";
import { map } from "./map";
import { notifications } from "./notifications";
import { notificationsPanel } from "./notificationsPanel";
import { recentFavoritesMenu } from "./recentFavoritesMenu";
import { recordDescribeForm } from "./recordDescribeForm";
import { reviewLinkViewer } from "./reviewLinkViewer";
import { search } from "./search";
import { searchResults } from "./searchResults";
import { shareViewer } from "./shareViewer";
import { sync } from "./sync";
import { whatsNewDialog } from "./whatsNewDialog";

export const pages = {
  activity,
  catalog,
  commandPalette,
  dataCenter,
  discover,
  duplicates,
  favorites,
  firstRun,
  geotagPanel,
  loading,
  login,
  map,
  notifications,
  notificationsPanel,
  recentFavoritesMenu,
  recordDescribeForm,
  reviewLinkViewer,
  search,
  searchResults,
  shareViewer,
  sync,
  whatsNewDialog,
} as const;
